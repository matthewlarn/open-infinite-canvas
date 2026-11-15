import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CanvasEngine, EngineOptions, EngineStats, FarColors } from "open-infinite-canvas";
import "open-infinite-canvas/styles.css";
import { InfiniteCanvas, useInfiniteCanvas } from "@open-infinite-canvas/react";
import "./screens/demo.css";
import "./app.css";
import { buildFrames, renderDemoFrame } from "./screens/registry";

/**
 * The giant demo. A member-run tool library, every screen of it, in every state, many times over.
 *
 *   ?n=300         how many screens (300 or more)
 *   ?isolated=4    how many of them run in iframe mode
 *   ?maxLive=24    the live budget
 *   ?maxParked=24  the parked budget
 *   ?theme=dark
 *   ?motion=reduce jump instead of gliding
 */
const q = new URLSearchParams(window.location.search);
const count = Math.max(300, Number(q.get("n") ?? 300) || 300);
const isolated = Math.max(0, Number(q.get("isolated") ?? 4) || 0);
const num = (key: string) => (q.has(key) ? Number(q.get(key)) : undefined);

const lod: NonNullable<EngineOptions["lod"]> = {};
for (const key of ["maxLive", "maxParked"] as const) {
  const v = num(key);
  if (v !== undefined && Number.isFinite(v)) lod[key] = v;
}
const options: EngineOptions = { lod, reducedMotion: q.get("motion") === "reduce" ? true : undefined };

/** A canvas cannot read CSS, so the far layer's colours are read from the theme and handed over. */
function readColors(): FarColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return { canvas: v("--ic-canvas"), surface: v("--surface"), border: v("--ic-border"), label: v("--ic-label"), accent: v("--ic-accent"), skeleton: v("--ic-skeleton") };
}

function Hud() {
  const engine = useInfiniteCanvas();
  const [s, setS] = useState<EngineStats>(() => engine.stats());
  useEffect(() => {
    const t = window.setInterval(() => setS(engine.stats()), 250);
    return () => window.clearInterval(t);
  }, [engine]);
  return (
    <div className="hud" role="status" aria-label="Canvas status">
      <span>
        <b>{Math.round(s.zoom * 100)}%</b> zoom
      </span>
      <span>
        <b>{s.frames}</b> screens
      </span>
      <span>
        <b>{s.live}</b> live
      </span>
      <span>
        <b>{s.parked}</b> parked
      </span>
      <span>
        <b>{s.pictures}</b> pictures
      </span>
      <span>
        <b>{(s.pictureBytes / 1048576).toFixed(1)}</b> MB
      </span>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState(q.get("theme") === "dark" ? "dark" : "light");
  const engineRef = useRef<CanvasEngine | null>(null);
  const frames = useMemo(() => {
    const list = buildFrames(count);
    /* A few desktop screens run in iframe mode, each in its own document. */
    let left = isolated;
    return list.map((f) => (left > 0 && f.device === "desktop" && left-- > 0 ? { ...f, name: `${f.name} (iframe)`, src: `screen.html?i=${f.seed}&theme=${theme}` } : f));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onReady = useCallback((engine: CanvasEngine) => {
    engineRef.current = engine;
    engine.setColors(readColors());
  }, []);

  /* A picture bakes in its colours, so a theme change makes every picture stale. */
  const firstTheme = useRef(theme);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    const engine = engineRef.current;
    if (!engine) return;
    engine.setColors(readColors());
    if (firstTheme.current !== theme) {
      firstTheme.current = theme;
      engine.invalidatePictures();
    }
  }, [theme]);

  return (
    <div className="app">
      <header className="toolbar">
        <strong>open-infinite-canvas</strong>
        <span className="toolbar-note">Harbor Street Tool Library, {frames.length} screens</span>
        <span className="toolbar-space" />
        <button type="button" className="toolbar-button" onClick={() => engineRef.current?.fit()}>
          Fit every screen
        </button>
        <button type="button" className="toolbar-button" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
          {theme === "dark" ? "Use light theme" : "Use dark theme"}
        </button>
      </header>
      <main className="stage">
        <InfiniteCanvas frames={frames} renderFrame={renderDemoFrame} options={options} label="Harbor Street Tool Library, every screen" onReady={onReady}>
          <Hud />
        </InfiniteCanvas>
      </main>
    </div>
  );
}

document.documentElement.setAttribute("data-theme", q.get("theme") === "dark" ? "dark" : "light");
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
