import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { fitRect, unionRects, zoomAt, type Camera } from "open-infinite-canvas";
import { renderDemoFrame, type DemoFrame } from "open-infinite-canvas-demo/screens";
import { publishBench } from "./bench-hooks";
import "./naive.css";

export type NaiveFlags = {
  /** `will-change: transform` on the element that carries the camera. */
  willChange: boolean;
  /** Publish the zoom as the inherited custom property `--z`, so names and outlines can stay one size on screen. */
  zoomVar: boolean;
  /** Re-declare `--z` on every screen body so its change stops there. */
  fence: boolean;
  /** `content-visibility: auto` on every screen body. */
  contentVisibility: boolean;
  /** Zoom with the CSS `zoom` property instead of a transform scale. The page is laid out again at every step. */
  cssZoom?: boolean;
  /** Every screen is its own same-origin iframe running the whole app, instead of a subtree of this document. */
  iframes?: boolean;
};

/**
 * The baseline. Every screen is mounted and live, inside one element that carries the camera transform.
 *
 * With every flag off this is the plain approach: "everything mounted, transform on a parent". With every flag on
 * it is the tuned version of the same idea: the zoom published as `--z`, a fence that stops that property from
 * restyling every screen, and `content-visibility: auto`. The benchmark calls that variant `today`.
 */
export function NaiveCanvas({ frames, flags, name }: { frames: DemoFrame[]; flags: NaiveFlags; name: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const zoomer = useRef<HTMLDivElement>(null);
  const cam = useRef<Camera>({ x: 0, y: 0, z: 1 });
  const bounds = useMemo(() => unionRects(frames), [frames]);

  const apply = () => {
    const { x, y, z } = cam.current;
    if (flags.cssZoom) {
      /* The move stays a transform. Only the scale becomes `zoom`, on an inner element, so the move is not scaled too. */
      if (content.current) content.current.style.transform = `translate(${x}px, ${y}px)`;
      if (zoomer.current) zoomer.current.style.zoom = String(z);
    } else if (content.current) content.current.style.transform = `translate(${x}px, ${y}px) scale(${z})`;
    if (flags.zoomVar) viewport.current?.style.setProperty("--z", String(z));
  };

  useLayoutEffect(() => {
    const el = viewport.current!;
    cam.current = fitRect(bounds, el.clientWidth, el.clientHeight, 64, 0.02, 1);
    apply();
    /* With iframes, the page is not ready until every one of them has loaded its own copy of the app. */
    const loaded = flags.iframes
      ? Promise.all(
          [...el.querySelectorAll("iframe")].map(
            (f) =>
              new Promise<void>((resolve) => {
                const done = () => resolve();
                if (f.contentDocument?.readyState === "complete" && f.contentWindow?.location.href !== "about:blank") done();
                else f.addEventListener("load", done, { once: true });
              }),
          ),
        ).then(() => undefined)
      : undefined;
    publishBench(
      {
        variant: name,
        frames,
        viewport: () => ({ w: el.clientWidth, h: el.clientHeight }),
        setCamera: (c) => {
          cam.current = c;
          apply();
        },
        getCamera: () => ({ ...cam.current }),
        stats: () => ({ frames: frames.length, live: frames.length }),
        idle: () => true,
      },
      loaded,
    );
  }, [bounds, frames]); // eslint-disable-line react-hooks/exhaustive-deps

  /* The same gestures as the engine, so the baseline can be used by hand. */
  useEffect(() => {
    const el = viewport.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const step = Math.max(-50, Math.min(50, e.deltaY));
        cam.current = zoomAt(cam.current, cam.current.z * Math.exp(-step * 0.01), e.clientX - r.left, e.clientY - r.top);
      } else {
        cam.current = { ...cam.current, x: cam.current.x - e.deltaX, y: cam.current.y - e.deltaY };
      }
      apply();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const theme = document.documentElement.getAttribute("data-theme") ?? "light";
  const list = frames.map((f) => (
    <div key={f.id} className="naive-frame" style={{ left: f.x, top: f.y, width: f.w, height: f.h }}>
      <div className="naive-label">{f.name}</div>
      {/* The outline reads the live zoom. The fence sits one level in, on the screen itself. */}
      <div className="naive-body">
        {flags.iframes ? (
          <iframe className="naive-iframe" title={f.name} src={`?v=single&i=${f.seed}&theme=${theme}`} width={f.w} height={f.h} />
        ) : (
          <div className="naive-root" data-fence={flags.fence || undefined} data-cv={flags.contentVisibility || undefined} style={flags.contentVisibility ? { containIntrinsicSize: `auto ${f.h}px` } : undefined}>
            {renderDemoFrame(f)}
          </div>
        )}
      </div>
    </div>
  ));

  return (
    <div ref={viewport} className="naive-viewport" data-zoom-var={flags.zoomVar || undefined} style={flags.zoomVar ? ({ "--z": 1 } as React.CSSProperties) : undefined}>
      <div ref={content} className="naive-content" style={{ willChange: flags.willChange ? "transform" : undefined }}>
        {flags.cssZoom ? (
          <div ref={zoomer} className="naive-zoomer">
            {list}
          </div>
        ) : (
          list
        )}
      </div>
    </div>
  );
}
