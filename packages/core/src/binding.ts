import { CanvasEngine, type EngineOptions, type MountedFrame } from "./engine.js";
import { attachInput } from "./input.js";
import { readingOrder, type Direction } from "./layout.js";
import type { FrameSpec } from "./types.js";

/** What counts as a control that can take focus inside a screen. */
export const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

/** The elements a view layer hands to {@link connectCanvas}. All four sit inside the viewport. */
export type CanvasParts = {
  /** The element that clips the canvas and receives gestures. Class `ic-viewport`. */
  viewport: HTMLElement;
  /** The element screens are mounted into. Class `ic-world`. */
  world: HTMLElement;
  /**
   * An empty ordered list. It is filled with one entry per frame for keyboards and screen readers. Class
   * `ic-list`. Put it before `world` in the document, so Tab reaches it before the controls of live screens.
   */
  list: HTMLElement;
  /** An empty polite live region. Selection is announced through it. Class `ic-sr`. */
  status: HTMLElement;
};

/** Options for {@link connectCanvas}. */
export type ConnectOptions = {
  /** The accessible name of the whole canvas. */
  label: string;
  /** Called when the selected frame changes, by pointer or by keyboard. */
  onSelect?: (id: string | null) => void;
};

/** What {@link connectCanvas} returns. */
export type CanvasConnection = {
  /** Rebuilds the keyboard list for a new set of frames. Call it after `engine.setFrames`. */
  setFrames(frames: readonly FrameSpec[]): void;
  /** Removes every listener and empties the list. */
  destroy(): void;
};

const ARROWS: Record<string, Direction> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };

/**
 * Wires an engine to its elements: pointer, wheel and key input, the keyboard list of every screen, focus
 * travel in and out of live screens, announcements, and the note that a screen was used.
 *
 * A view layer calls this once after `engine.mount`. It is everything about the canvas that is not rendering
 * screens, so every view layer behaves the same for a keyboard and a screen reader.
 *
 * What it sets up:
 *
 * - One tab stop in the list. Arrow keys move to the nearest screen in that direction. Home and End go to the
 *   first and last.
 * - Focus on an entry selects that screen, rings it, pans it into view and announces its name and position.
 * - Enter or Space opens the screen and moves focus to its first control once it is live.
 * - Escape inside a live screen returns focus to that screen's entry.
 */
export function connectCanvas(engine: CanvasEngine, parts: CanvasParts, options: ConnectOptions): CanvasConnection {
  const { viewport, world, list, status } = parts;
  const doc = viewport.ownerDocument;
  let order: string[] = [];
  let names = new Map<string, string>();
  let buttons = new Map<string, HTMLButtonElement>();
  let tabStop: string | null = null;
  let opening = 0;

  const setTabStop = (id: string | null) => {
    const next = id ?? order[0] ?? null;
    if (next === tabStop) return;
    if (tabStop) buttons.get(tabStop)?.setAttribute("tabindex", "-1");
    tabStop = next;
    if (next) buttons.get(next)?.setAttribute("tabindex", "0");
  };

  const select = (id: string | null) => {
    engine.select(id);
    setTabStop(id);
    options.onSelect?.(id);
  };

  const detachInput = attachInput(engine, viewport, {
    isInteractive: (t) => !!t.closest('.ic-frame[data-mode="live"], [data-ic-chrome]'),
    onSelect: select,
    onOpen: (id) => engine.fitFrame(id),
  });

  const idOf = (target: EventTarget | null) => (target as Element | null)?.closest?.<HTMLElement>("[data-frame]")?.dataset.frame ?? null;
  const focusItem = (id: string | undefined) => {
    if (id) buttons.get(id)?.focus();
  };
  const hostOf = (id: string) => world.querySelector<HTMLElement>(`.ic-frame[data-ic-frame="${CSS.escape(id)}"][data-mode="live"]`);

  const onFocusIn = (e: FocusEvent) => {
    const id = idOf(e.target);
    if (!id) return;
    select(id);
    engine.reveal(id);
    status.textContent = `${names.get(id) ?? "Screen"}. Screen ${order.indexOf(id) + 1} of ${order.length}.`;
  };

  const onListKey = (e: KeyboardEvent) => {
    const id = idOf(e.target);
    if (!id || e.metaKey || e.ctrlKey || e.altKey) return;
    const dir = ARROWS[e.key];
    if (dir) {
      focusItem(engine.neighbour(id, dir)?.id);
    } else if (e.key === "Home") {
      focusItem(order[0]);
    } else if (e.key === "End") {
      focusItem(order[order.length - 1]);
    } else if (e.key === "Enter" || e.key === " ") {
      /* Open the screen: zoom to it, wait for it to come alive, then move focus inside. */
      engine.fitFrame(id);
      status.textContent = `Opening ${names.get(id) ?? "screen"}. Press Escape to return to the list of screens.`;
      let tries = 0;
      cancelAnimationFrame(opening);
      const enter = () => {
        const first = hostOf(id)?.querySelector<HTMLElement>(FOCUSABLE);
        if (first) first.focus({ preventScroll: true });
        else if (tries++ < 120) opening = requestAnimationFrame(enter);
      };
      opening = requestAnimationFrame(enter);
    } else return;
    e.preventDefault();
  };

  /* Escape inside a live screen returns to that screen's entry in the list. */
  const onWorldKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    const id = (e.target as Element).closest<HTMLElement>(".ic-frame")?.dataset.icFrame;
    if (id) {
      e.stopPropagation();
      focusItem(id);
    }
  };

  /* A screen that was used gets a fresh picture when it stops being live. */
  const onTouch = (e: Event) => {
    const id = (e.target as Element | null)?.closest?.<HTMLElement>(".ic-frame")?.dataset.icFrame;
    if (id) engine.touch(id);
  };

  list.addEventListener("focusin", onFocusIn);
  list.addEventListener("keydown", onListKey);
  world.addEventListener("keydown", onWorldKey);
  world.addEventListener("pointerdown", onTouch, true);
  world.addEventListener("keydown", onTouch, true);
  world.addEventListener("input", onTouch, true);

  return {
    setFrames(frames) {
      order = readingOrder(frames);
      names = new Map(frames.map((f) => [f.id, f.name]));
      buttons = new Map();
      tabStop = null;
      list.setAttribute("aria-label", `${options.label}: ${frames.length} screens`);
      const fragment = doc.createDocumentFragment();
      order.forEach((id, i) => {
        const li = doc.createElement("li");
        const button = doc.createElement("button");
        button.type = "button";
        button.dataset.frame = id;
        button.tabIndex = -1;
        button.setAttribute("aria-posinset", String(i + 1));
        button.setAttribute("aria-setsize", String(order.length));
        button.textContent = names.get(id)!;
        li.appendChild(button);
        fragment.appendChild(li);
        buttons.set(id, button);
      });
      list.replaceChildren(fragment);
      setTabStop(null);
    },
    destroy() {
      cancelAnimationFrame(opening);
      detachInput();
      list.removeEventListener("focusin", onFocusIn);
      list.removeEventListener("keydown", onListKey);
      world.removeEventListener("keydown", onWorldKey);
      world.removeEventListener("pointerdown", onTouch, true);
      world.removeEventListener("keydown", onTouch, true);
      world.removeEventListener("input", onTouch, true);
      list.replaceChildren();
    },
  };
}

/** Options for {@link mountCanvas}. */
export type MountOptions = EngineOptions & {
  frames: readonly FrameSpec[];
  /** The accessible name of the whole canvas. */
  label: string;
  /**
   * Fills the host element of a screen that is being mounted. May return a function that cleans up when the
   * screen is unmounted. Not called for a frame with `src`, which is given an iframe.
   */
  renderFrame: (frame: FrameSpec, host: HTMLElement) => void | (() => void);
  /** Called when the selected frame changes. */
  onSelect?: (id: string | null) => void;
};

/** What {@link mountCanvas} returns. */
export type MountedCanvas = {
  engine: CanvasEngine;
  /** The viewport element that was added to the container. */
  element: HTMLElement;
  /** Replaces the frames. */
  setFrames(frames: readonly FrameSpec[]): void;
  /** Unmounts every screen, removes the viewport and destroys the engine. */
  destroy(): void;
};

/**
 * A complete canvas in plain DOM, with no framework.
 *
 * It builds the viewport inside `container`, mounts and unmounts screens as the engine asks, and wires up
 * input and the keyboard list. Import `open-infinite-canvas/styles.css` once, and give the container a size.
 *
 * A parked screen is hidden with `display: none`. Its DOM and state are kept, but nothing pauses its timers.
 * The React binding pauses effects as well.
 *
 * @example
 * const canvas = mountCanvas(document.getElementById("stage"), {
 *   label: "Every screen",
 *   frames,
 *   renderFrame(frame, host) {
 *     host.innerHTML = `<h1>${frame.name}</h1>`;
 *   },
 * });
 */
export function mountCanvas(container: HTMLElement, options: MountOptions): MountedCanvas {
  const doc = container.ownerDocument;
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
    const el = doc.createElement(tag);
    el.className = className;
    return el;
  };
  const viewport = make("div", "ic-viewport");
  viewport.tabIndex = 0;
  viewport.setAttribute("role", "group");
  viewport.setAttribute("aria-roledescription", "canvas");
  viewport.setAttribute("aria-label", options.label);
  const far = make("canvas", "ic-far");
  far.setAttribute("aria-hidden", "true");
  const world = make("div", "ic-world");
  const list = make("ol", "ic-list");
  const status = make("div", "ic-sr");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  /* The list comes before the screens, so Tab reaches it first and the controls of live screens after it. */
  viewport.append(far, list, world, status);
  container.appendChild(viewport);

  const engine = new CanvasEngine(options);
  engine.mount(viewport, world, far);
  const connection = connectCanvas(engine, { viewport, world, list, status }, { label: options.label, onSelect: options.onSelect });

  let byId = new Map<string, FrameSpec>();
  const hosts = new Map<string, { el: HTMLElement; mode: MountedFrame["mode"]; cleanup: void | (() => void) }>();

  const unmount = (id: string) => {
    const host = hosts.get(id);
    if (!host) return;
    hosts.delete(id);
    engine.attach(id, null);
    try {
      host.cleanup?.();
    } finally {
      host.el.remove();
    }
  };

  const render = () => {
    const wanted = new Map(engine.getStructure().mounted.map((m) => [m.id, m]));
    for (const id of [...hosts.keys()]) if (!wanted.has(id)) unmount(id);
    for (const m of wanted.values()) {
      const frame = byId.get(m.id);
      if (!frame) continue;
      let host = hosts.get(m.id);
      if (!host) {
        const el = make("div", "ic-frame");
        el.dataset.icFrame = frame.id;
        el.dataset.mode = m.mode;
        el.style.width = `${frame.w}px`;
        el.style.height = `${frame.h}px`;
        el.inert = m.mode !== "live";
        world.appendChild(el);
        let cleanup: void | (() => void) = undefined;
        if (frame.src) {
          const iframe = doc.createElement("iframe");
          iframe.className = "ic-iframe";
          iframe.title = frame.name;
          iframe.src = frame.src;
          el.appendChild(iframe);
        } else cleanup = options.renderFrame(frame, el);
        host = { el, mode: m.mode, cleanup };
        hosts.set(m.id, host);
        engine.attach(frame.id, el);
        if (m.mode === "live") engine.shown(frame.id);
      } else if (host.mode !== m.mode) {
        host.mode = m.mode;
        host.el.dataset.mode = m.mode;
        host.el.inert = m.mode !== "live";
        if (m.mode === "live") engine.shown(frame.id);
      }
    }
  };
  const unsubscribe = engine.subscribe(render);

  const setFrames = (frames: readonly FrameSpec[]) => {
    for (const id of [...hosts.keys()]) unmount(id);
    byId = new Map(frames.map((f) => [f.id, f]));
    engine.setFrames(frames);
    connection.setFrames(frames);
    engine.fit(undefined, { animate: false });
  };
  setFrames(options.frames);

  return {
    engine,
    element: viewport,
    setFrames,
    destroy() {
      unsubscribe();
      for (const id of [...hosts.keys()]) unmount(id);
      connection.destroy();
      engine.destroy();
      viewport.remove();
    },
  };
}
