import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { autoProvider, htmlInCanvasProvider, htmlInCanvasSupport, invalidateCss, pageCss, screenshotProvider, svgProvider, type EngineOptions, type FrameSpec, type PictureProvider } from "open-infinite-canvas";
import "open-infinite-canvas/styles.css";
import { hasActivity } from "@open-infinite-canvas/react";
import "open-infinite-canvas-demo/screens.css";
import { buildFrames, renderDemoFrame } from "open-infinite-canvas-demo/screens";
import "./app.css";
import { EngineCanvas } from "./EngineCanvas";
import { NaiveCanvas, type NaiveFlags } from "./NaiveCanvas";

/**
 * The benchmark page. One page, chosen by the query string.
 *
 *   ?v=engine      open-infinite-canvas, from the packaged build (default)
 *   ?v=naive       every screen mounted, one transformed parent
 *   ?v=today       naive plus --z, the zoom fence and content-visibility: auto
 *   ?v=pre         naive plus --z with no fence
 *   ?v=naive-nowc  naive with no will-change
 *   ?v=csszoom     naive, but the scale is the CSS `zoom` property
 *   ?v=iframes     naive, but every screen is an iframe that loads the whole app (?v=single&i=N)
 *   ?n=300         how many screens
 *   ?theme=dark
 *   ?provider=svg | html-in-canvas | auto | screenshot    how the engine makes pictures
 *   ?isolate=3     run the first few screens in iframe mode
 *   ?shot=3        give the first few screens a build-time picture
 *   ?maxLive= ?maxParked= ?settleMs= and the other level of detail settings
 */
const q = new URLSearchParams(window.location.search);
const variant = q.get("v") ?? "engine";
const count = Math.max(1, Number(q.get("n") ?? 300));
const num = (key: string) => (q.has(key) ? Number(q.get(key)) : undefined);

const NAIVE: Record<string, NaiveFlags> = {
  naive: { willChange: true, zoomVar: false, fence: false, contentVisibility: false },
  "naive-nowc": { willChange: false, zoomVar: false, fence: false, contentVisibility: false },
  pre: { willChange: true, zoomVar: true, fence: false, contentVisibility: false },
  today: { willChange: true, zoomVar: true, fence: true, contentVisibility: true },
  csszoom: { willChange: false, zoomVar: false, fence: false, contentVisibility: false, cssZoom: true },
  iframes: { willChange: true, zoomVar: false, fence: false, contentVisibility: false, iframes: true },
};

/** A picture made on the spot, standing in for a file a build step would have written. */
function stubShot(frame: FrameSpec): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.w}" height="${frame.h}"><rect width="100%" height="100%" fill="#1d4f3b"/><circle cx="${frame.w / 2}" cy="${frame.h / 2}" r="${frame.w / 4}" fill="#f0a685"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const PROVIDERS: Record<string, () => PictureProvider> = {
  svg: svgProvider,
  "html-in-canvas": htmlInCanvasProvider,
  auto: autoProvider,
  screenshot: () => screenshotProvider({ url: stubShot }),
};

const pictureErrors: string[] = [];
const lod: NonNullable<EngineOptions["lod"]> = {};
for (const key of ["maxLive", "maxParked", "liveInScale", "liveOutScale", "tinyScale", "thumbScale", "previewScale", "maxThumbs", "maxPreviews", "marginPx", "settleMs"] as const) {
  const v = num(key);
  if (v !== undefined) lod[key] = v;
}
const engineOptions: EngineOptions = {
  lod,
  provider: PROVIDERS[q.get("provider") ?? ""]?.(),
  willChange: (q.get("wc") as EngineOptions["willChange"]) ?? "gesture",
  warmup: q.get("warm") !== "0",
  origin: (q.get("origin") as EngineOptions["origin"]) ?? "floating",
  reducedMotion: q.get("motion") === "reduce" ? true : q.get("motion") === "full" ? false : undefined,
  onPictureError: (frame, error) => pictureErrors.push(`${frame.id}: ${String((error as Error)?.message ?? error)}`),
};

function App() {
  const [theme] = useState(q.get("theme") === "dark" ? "dark" : "light");
  /* `far` moves the whole world away from the origin, to test how each variant copes with very large coordinates. */
  const frames = useMemo(() => {
    let list = buildFrames(count);
    const far = num("far") ?? 0;
    if (far) list = list.map((f) => ({ ...f, x: f.x + far, y: f.y + far }));
    const isolate = num("isolate") ?? 0;
    const shot = num("shot") ?? 0;
    return list.map((f, i) => ({ ...f, ...(i < isolate ? { src: `?v=single&i=${f.seed}&theme=${theme}` } : null), ...(i >= isolate && i < isolate + shot ? { picture: stubShot(f) } : null) }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  return (
    <div className="app">
      <main className="stage">{variant in NAIVE ? <NaiveCanvas frames={frames} flags={NAIVE[variant]} name={variant} /> : <EngineCanvas frames={frames} options={engineOptions} theme={theme} />}</main>
    </div>
  );
}

/* The picture takers on their own, so the benchmark can time them without the rest of the engine. */
const svg = svgProvider();
const frameOf = (el: HTMLElement, w: number, h: number): FrameSpec => ({ id: el.dataset.icFrame ?? "bench", name: "bench", x: 0, y: 0, w, h });
(window as unknown as { __snapshot: unknown }).__snapshot = {
  capture: (el: HTMLElement, w: number, h: number, scale: number) => svg.capture({ frame: frameOf(el, w, h), el, w, h }, scale),
  captureBatch: (items: { el: HTMLElement; w: number; h: number }[], scale: number) => svg.captureMany!(items.map((it) => ({ frame: frameOf(it.el, it.w, it.h), ...it })), scale),
  pageCss,
  invalidateCss,
  hasDrawElement: htmlInCanvasSupport,
  hasActivity,
  pictureErrors,
};

/** One screen filling the window. What each iframe loads. */
function Single() {
  const index = Math.max(0, Number(q.get("i") ?? 0));
  const frame = useMemo(() => buildFrames(index + 1).find((f) => f.seed === index)!, [index]);
  return <div style={{ width: "100vw", height: "100vh" }}>{renderDemoFrame(frame)}</div>;
}

document.documentElement.setAttribute("data-theme", q.get("theme") === "dark" ? "dark" : "light");
const root = createRoot(document.getElementById("root")!);
/* Strict mode mounts everything twice in development. The benchmark runs a production build, where it does nothing. */
root.render(<StrictMode>{variant === "single" ? <Single /> : <App />}</StrictMode>);
