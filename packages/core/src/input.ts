import type { CanvasEngine } from "./engine.js";

/** Options for {@link attachInput}. */
export type InputOptions = {
  /** Elements that keep their own pointer and wheel behaviour, for example a live frame. */
  isInteractive: (target: Element) => boolean;
  /** A click on a frame, or on empty canvas (null). */
  onSelect?: (id: string | null) => void;
  /** A double click on a frame. */
  onOpen?: (id: string) => void;
};

/** True if `target` or an ancestor up to `stop` can scroll further in the direction of the wheel. */
function canScroll(target: Element | null, stop: Element, dx: number, dy: number): boolean {
  const sideways = Math.abs(dx) > Math.abs(dy);
  for (let node = target; node && node !== stop; node = node.parentElement) {
    if (!(node instanceof HTMLElement)) continue;
    if (sideways ? node.scrollWidth <= node.clientWidth + 1 : node.scrollHeight <= node.clientHeight + 1) continue;
    const cs = getComputedStyle(node);
    if (!/(auto|scroll)/.test(sideways ? cs.overflowX : cs.overflowY)) continue;
    if (sideways) {
      if (dx < 0 ? node.scrollLeft > 0 : node.scrollLeft + node.clientWidth < node.scrollWidth - 1) return true;
    } else if (dy < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight - 1) return true;
  }
  return false;
}

/**
 * Pointer, wheel, pinch and keyboard handling for one viewport.
 *
 *   Scroll or two-finger drag    pan
 *   Pinch, or Ctrl/Cmd + scroll  zoom toward the pointer
 *   Drag empty canvas            pan, with a short glide on release
 *   Middle button, or Space      pan from anywhere
 *   Arrow keys                   pan (Shift for larger steps)
 *   + and -                      zoom about the centre
 *   0                            100%
 *   1                            fit everything
 *   2                            fit the selected frame
 *
 * Ctrl/Cmd + plus and minus are left alone. They belong to the browser's own zoom, which some people depend on.
 *
 * @returns A function that removes every listener.
 */
export function attachInput(engine: CanvasEngine, viewport: HTMLElement, options: InputOptions): () => void {
  const rect = () => viewport.getBoundingClientRect();
  let space = false;

  const onWheel = (e: WheelEvent) => {
    const target = e.target as Element | null;
    const zooming = e.ctrlKey || e.metaKey;
    if (!zooming && target && options.isInteractive(target) && canScroll(target, viewport, e.deltaX, e.deltaY)) return;
    e.preventDefault();
    const r = rect();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1;
    let dx = e.deltaX * unit;
    let dy = e.deltaY * unit;
    if (zooming) {
      /* A pinch arrives as small steps, a wheel notch as a large one. The cap keeps a notch from jumping. */
      const step = Math.max(-50, Math.min(50, dy));
      engine.zoomAtPoint(engine.getCamera().z * Math.exp(-step * 0.01), e.clientX - r.left, e.clientY - r.top);
      return;
    }
    if (e.shiftKey && dx === 0) [dx, dy] = [dy, 0];
    engine.panBy(-dx, -dy);
  };

  /* Safari sends a trackpad pinch as gesture events, not as ctrl + wheel. */
  let gestureZ = 1;
  type GestureEvent = Event & { scale: number; clientX: number; clientY: number };
  const onGestureStart = (e: Event) => {
    e.preventDefault();
    gestureZ = engine.getCamera().z;
  };
  const onGestureChange = (e: Event) => {
    e.preventDefault();
    const g = e as GestureEvent;
    const r = rect();
    engine.zoomAtPoint(gestureZ * g.scale, g.clientX - r.left, g.clientY - r.top);
  };

  /* Drag to pan, and two touches to pinch. */
  const pointers = new Map<number, { x: number; y: number }>();
  let drag: { id: number; x: number; y: number; moved: boolean; onFrame: string | null; samples: { t: number; x: number; y: number }[] } | null = null;
  let pinch: { d: number; z: number } | null = null;
  let glide = 0;

  const stopGlide = () => {
    if (glide) cancelAnimationFrame(glide);
    glide = 0;
  };

  const onPointerDown = (e: PointerEvent) => {
    stopGlide();
    const target = e.target as Element;
    const forced = space || e.button === 1;
    if (e.button !== 0 && e.button !== 1) return;
    if (!forced && options.isInteractive(target)) return;
    e.preventDefault();
    viewport.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: engine.getCamera().z };
      drag = null;
      return;
    }
    const r = rect();
    const hit = forced ? null : engine.frameAt(e.clientX - r.left, e.clientY - r.top);
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, onFrame: hit?.id ?? null, samples: [] };
  };

  const onPointerMove = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (pinch && pointers.size === 2) {
      p.x = e.clientX;
      p.y = e.clientY;
      const [a, b] = [...pointers.values()];
      const r = rect();
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      engine.zoomAtPoint((pinch.z * d) / pinch.d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    drag.moved = true;
    drag.x = e.clientX;
    drag.y = e.clientY;
    p.x = e.clientX;
    p.y = e.clientY;
    drag.samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    if (drag.samples.length > 6) drag.samples.shift();
    engine.panBy(dx, dy);
  };

  const onPointerUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    const d = drag;
    if (!d || d.id !== e.pointerId) return;
    drag = null;
    if (!d.moved) {
      options.onSelect?.(d.onFrame);
      return;
    }
    /* A short glide after a flick. Skipped for anyone who asked for less motion. */
    if (engine.reducedMotion || d.samples.length < 2) return;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const dt = last.t - first.t;
    if (dt <= 0 || e.timeStamp - last.t > 60) return;
    let vx = (last.x - first.x) / dt;
    let vy = (last.y - first.y) / dt;
    if (Math.hypot(vx, vy) < 0.3) return;
    let prev = performance.now();
    const step = (now: number) => {
      const elapsed = Math.min(40, now - prev);
      prev = now;
      engine.panBy(vx * elapsed, vy * elapsed);
      const decay = Math.pow(0.94, elapsed / 16.7);
      vx *= decay;
      vy *= decay;
      glide = Math.hypot(vx, vy) > 0.02 ? requestAnimationFrame(step) : 0;
    };
    glide = requestAnimationFrame(step);
  };

  const onDoubleClick = (e: MouseEvent) => {
    if (options.isInteractive(e.target as Element)) return;
    const r = rect();
    const hit = engine.frameAt(e.clientX - r.left, e.clientY - r.top);
    if (hit) options.onOpen?.(hit.id);
  };

  const typing = (t: EventTarget | null) => {
    const el = t as HTMLElement | null;
    return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Space" && !typing(e.target) && !options.isInteractive(e.target as Element)) space = true;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    /* Shortcuts act only when the canvas itself has focus, never while a control inside a screen does. */
    if (e.target !== viewport) return;
    const cam = engine.getCamera();
    const { w, h } = engine.getViewport();
    const step = e.shiftKey ? 256 : 64;
    switch (e.key) {
      case "ArrowLeft": engine.panBy(step, 0); break;
      case "ArrowRight": engine.panBy(-step, 0); break;
      case "ArrowUp": engine.panBy(0, step); break;
      case "ArrowDown": engine.panBy(0, -step); break;
      case "+":
      case "=": engine.zoomAtPoint(cam.z * 1.25, w / 2, h / 2); break;
      case "-": engine.zoomAtPoint(cam.z / 1.25, w / 2, h / 2); break;
      case "0": engine.zoomAtPoint(1, w / 2, h / 2); break;
      case "1": engine.fit(); break;
      case "2": {
        const s = engine.getSelected();
        if (s) engine.fitFrame(s.id);
        break;
      }
      default: return;
    }
    e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space") space = false;
  };
  const onBlur = () => {
    space = false;
  };

  /* When focus moves to a control that is partly out of view, the browser scrolls the viewport to show it.
     The viewport must never scroll, so the scroll is turned into a camera move. The camera follows focus. */
  const onScroll = () => {
    const dx = viewport.scrollLeft;
    const dy = viewport.scrollTop;
    if (!dx && !dy) return;
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
    engine.panBy(-dx, -dy);
  };
  viewport.addEventListener("scroll", onScroll);

  viewport.addEventListener("wheel", onWheel, { passive: false });
  viewport.addEventListener("gesturestart", onGestureStart);
  viewport.addEventListener("gesturechange", onGestureChange);
  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", onPointerUp);
  viewport.addEventListener("pointercancel", onPointerUp);
  viewport.addEventListener("dblclick", onDoubleClick);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  return () => {
    stopGlide();
    viewport.removeEventListener("scroll", onScroll);
    viewport.removeEventListener("wheel", onWheel);
    viewport.removeEventListener("gesturestart", onGestureStart);
    viewport.removeEventListener("gesturechange", onGestureChange);
    viewport.removeEventListener("pointerdown", onPointerDown);
    viewport.removeEventListener("pointermove", onPointerMove);
    viewport.removeEventListener("pointerup", onPointerUp);
    viewport.removeEventListener("pointercancel", onPointerUp);
    viewport.removeEventListener("dblclick", onDoubleClick);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
  };
}
