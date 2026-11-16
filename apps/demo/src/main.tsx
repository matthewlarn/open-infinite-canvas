import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CanvasEngine, EngineOptions, FarColors, FrameSpec } from "open-infinite-canvas";
import "open-infinite-canvas/styles.css";
import { InfiniteCanvas } from "@open-infinite-canvas/react";
import "./screens/demo.css";
import "./app.css";
import "./controls/panel.css";
import { buildFrames, renderDemoFrame } from "./screens/registry";
import { DebugOverlay, StatsSampler, runBenchmark, type BenchmarkResult, type LiveStats } from "./controls/instruments";
import { Panel, type PanelActions } from "./controls/Panel";
import { DEFAULTS, PRESETS, applyPatch, clearSaved, encodeHash, loadSettings, makeProvider, saveSettings, toEngine, type Group, type PresetName, type Settings } from "./controls/settings";

/**
 * The giant demo. A member-run tool library, every screen of it, in every state, many times over, with a
 * control panel that changes the running engine.
 *
 * Settings come from the address bar (`#settings=...`), then from this browser's storage. These older query
 * parameters still work on top:
 *
 *   ?n=300         how many screens (50 to 2000)
 *   ?isolated=4    how many of them run in iframe mode
 *   ?maxLive=24    the live budget
 *   ?maxParked=24  the parked budget
 *   ?theme=dark
 *   ?motion=reduce jump instead of gliding
 *   ?panel=open    start with the control panel open
 */
const q = new URLSearchParams(window.location.search);
const PANEL_KEY = "open-infinite-canvas-demo:panel";

type DemoHooks = { engine: () => CanvasEngine | null; settings: () => Settings; lastBenchmark: BenchmarkResult | null };
const hooks = (): DemoHooks => (window as unknown as { __demo: DemoHooks }).__demo;

/** A canvas cannot read CSS, so the far layer's colours are read from the theme and handed over. */
function readColors(): FarColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return { canvas: v("--ic-canvas"), surface: v("--surface"), border: v("--ic-border"), label: v("--ic-label"), accent: v("--ic-accent"), skeleton: v("--ic-skeleton") };
}

function readPanelOpen(): boolean {
  if (q.get("panel") === "open") return true;
  try {
    return localStorage.getItem(PANEL_KEY) === "open";
  } catch {
    return false;
  }
}

function makeFrames(screens: Settings["screens"], theme: string): FrameSpec[] {
  const list = buildFrames(screens.count, { columns: screens.columns, gap: screens.gap, device: screens.device });
  /* A few screens run in iframe mode, each in its own document. Desktop screens first, then any. */
  const picked = new Set<number>();
  for (const f of list) if (picked.size < screens.iframes && f.device === "desktop") picked.add(f.seed);
  for (const f of list) if (picked.size < screens.iframes) picked.add(f.seed);
  return list.map((f) => (picked.has(f.seed) ? { ...f, name: `${f.name} (iframe)`, src: `screen.html?i=${f.seed}&theme=${theme}` } : f));
}

function Hud({ stats, full }: { stats: LiveStats | null; full: boolean }) {
  if (!stats) return null;
  const e = stats.engine;
  const item = (value: string | number, label: string) => (
    <span key={label}>
      <b>{value}</b> {label}
    </span>
  );
  return (
    <div className="hud" role="status" aria-label="Canvas status" data-full={full ? "" : undefined}>
      {item(`${Math.round(e.zoom * 100)}%`, "zoom")}
      {item(e.frames, "screens")}
      {item(e.live, "live")}
      {item(e.parked, "parked")}
      {item(e.pictures, "pictures")}
      {item((e.pictureBytes / 1048576).toFixed(1), "MB")}
      {full
        ? [
            item(stats.fps, "fps"),
            item(stats.frameMsAvg.toFixed(1), "ms a frame"),
            item(stats.frameMsMax.toFixed(0), "ms worst frame"),
            item(stats.longTasks ?? "n/a", "long tasks"),
            item(stats.heapMb === null ? "n/a" : stats.heapMb.toFixed(0), "MB heap"),
            item(stats.domNodes, "DOM nodes"),
            item(e.staging, "staging"),
            item(e.placeholders, "placeholders"),
            item(e.pictureQueue, "queued"),
            item(e.capturesInFlight, "capturing"),
            item(e.tickMsAvg.toFixed(2), "ms engine work"),
          ]
        : null}
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState(q.get("theme") === "dark" ? "dark" : "light");
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [panelOpen, setPanelOpen] = useState(readPanelOpen);
  const [engine, setEngine] = useState<CanvasEngine | null>(null);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [bench, setBench] = useState<{ running: string | null; result: BenchmarkResult | null }>({ running: null, result: null });
  const [pictureErrors, setPictureErrors] = useState(0);
  const engineRef = useRef<CanvasEngine | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const themeRef = useRef(theme);
  themeRef.current = theme;

  /* The frame list is rebuilt a moment after the last change, so dragging the count slider stays smooth. */
  const [screens, setScreens] = useState(settings.screens);
  useEffect(() => {
    const t = window.setTimeout(() => setScreens(settings.screens), 250);
    return () => window.clearTimeout(t);
  }, [settings.screens]);
  const frames = useMemo(() => makeFrames(screens, themeRef.current), [screens]);

  /* Read once, when the engine is made. Every later change goes through engine.reconfigure. */
  const [options] = useState<EngineOptions>(() => {
    const { reducedMotion, ...rest } = toEngine(settings);
    return { ...rest, reducedMotion: reducedMotion ?? undefined, provider: makeProvider(settings.pictures.provider), onPictureError: () => setPictureErrors((n) => n + 1) };
  });

  const onReady = useCallback((made: CanvasEngine) => {
    engineRef.current = made;
    made.setColors(readColors());
    setEngine(made);
  }, []);

  /* Engine settings. Only a change to what the engine reads reconfigures it. */
  const engineKey = JSON.stringify(toEngine(settings));
  useEffect(() => {
    if (engine) engine.reconfigure(JSON.parse(engineKey));
  }, [engine, engineKey]);
  const appliedProvider = useRef(settings.pictures.provider);
  useEffect(() => {
    if (!engine || appliedProvider.current === settings.pictures.provider) return;
    appliedProvider.current = settings.pictures.provider;
    setPictureErrors(0);
    engine.reconfigure({ provider: makeProvider(settings.pictures.provider) });
  }, [engine, settings.pictures.provider]);

  /* Saved to the address bar and this browser on every change. */
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => {
    try {
      localStorage.setItem(PANEL_KEY, panelOpen ? "open" : "closed");
    } catch {
      /* Storage can be refused. The panel still works. */
    }
  }, [panelOpen]);

  /* A picture bakes in its colours, so a theme change makes every picture stale. */
  const firstTheme = useRef(theme);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (!engine) return;
    engine.setColors(readColors());
    if (firstTheme.current !== theme) {
      firstTheme.current = theme;
      engine.invalidatePictures();
    }
  }, [theme, engine]);

  /* Stats once a second. */
  useEffect(() => {
    if (!engine) return;
    const sampler = new StatsSampler(engine, setStats);
    sampler.start();
    return () => sampler.stop();
  }, [engine]);

  /* The debug overlay. */
  const overlayCanvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<DebugOverlay | null>(null);
  useEffect(() => {
    const made = new DebugOverlay(overlayCanvas.current!, () => engineRef.current);
    overlay.current = made;
    return () => made.destroy();
  }, []);
  const { tiers, hitBoxes, cells } = settings.debug;
  useEffect(() => overlay.current?.set({ tiers, hitBoxes, cells }), [tiers, hitBoxes, cells]);

  const set = useCallback(<G extends Group, K extends keyof Settings[G]>(group: G, key: K, value: Settings[G][K]) => {
    setSettings((s) => ({ ...s, [group]: { ...s[group], [key]: value } }));
  }, []);

  const json = () =>
    JSON.stringify(
      {
        settings,
        engine: engine?.getOptions() ?? null,
        stats,
        benchmark: bench.result,
        page: { userAgent: navigator.userAgent, devicePixelRatio: window.devicePixelRatio, viewport: engine?.getViewport() ?? null, theme },
      },
      null,
      2,
    );

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const actions: PanelActions = {
    fitAll: () => engine?.fit(),
    resetCamera: () => engine?.animateTo({ x: 0, y: 0, z: 1 }),
    zoomTo100: () => {
      if (!engine) return;
      const { w, h } = engine.getViewport();
      engine.zoomAtPoint(1, w / 2, h / 2);
    },
    goToScreen: (n) => {
      if (!engine || !engine.frames.length) return;
      const f = engine.frames[Math.min(engine.frames.length, Math.max(1, Math.round(n) || 1)) - 1];
      engine.select(f.id);
      engine.fitFrame(f.id);
    },
    preset: (name: PresetName) => setSettings((s) => applyPatch(s, PRESETS[name].patch)),
    reset: () => {
      clearSaved();
      setSettings(structuredClone(DEFAULTS));
    },
    copyLink: () => copy(`${window.location.origin}${window.location.pathname}${window.location.search}${encodeHash(settingsRef.current)}`),
    copyJson: () => copy(json()),
    json,
    runBenchmark: () => {
      if (!engine || bench.running) return;
      setBench({ running: "Starting", result: null });
      void runBenchmark(engine, (label) => setBench({ running: label, result: null })).then((result) => {
        setBench({ running: null, result });
        hooks().lastBenchmark = result;
      });
    },
  };

  /* Hooks for the end-to-end tests, and for poking at the engine from the console. */
  useEffect(() => {
    (window as unknown as { __demo: DemoHooks }).__demo = { engine: () => engineRef.current, settings: () => settingsRef.current, lastBenchmark: null };
  }, []);

  return (
    <div className="app">
      <header className="toolbar">
        <strong>open-infinite-canvas</strong>
        <span className="toolbar-note">Harbor Street Tool Library, {frames.length} screens</span>
        <span className="toolbar-space" />
        <button type="button" className="toolbar-button" onClick={() => engine?.fit()}>
          Fit every screen
        </button>
        <button type="button" className="toolbar-button" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
          {theme === "dark" ? "Use light theme" : "Use dark theme"}
        </button>
        <button type="button" className="toolbar-button" aria-expanded={panelOpen} aria-controls="controls" onClick={() => setPanelOpen((o) => !o)}>
          Controls
        </button>
      </header>
      <div className="workspace">
        <main
          className="stage"
          data-outlines={settings.debug.outlines ? "" : undefined}
          onPointerMove={(ev) => {
            const r = ev.currentTarget.getBoundingClientRect();
            overlay.current?.setPointer({ x: ev.clientX - r.left, y: ev.clientY - r.top });
          }}
          onPointerLeave={() => overlay.current?.setPointer(null)}
        >
          <InfiniteCanvas frames={frames} renderFrame={renderDemoFrame} options={options} label="Harbor Street Tool Library, every screen" onReady={onReady}>
            <Hud stats={stats} full={settings.debug.hud} />
          </InfiniteCanvas>
          <canvas ref={overlayCanvas} className="debug-overlay" aria-hidden="true" />
        </main>
        <Panel id="controls" open={panelOpen} settings={settings} set={set} actions={actions} stats={stats} benchmark={bench} frameCount={frames.length} pictureErrors={pictureErrors} />
      </div>
    </div>
  );
}

document.documentElement.setAttribute("data-theme", q.get("theme") === "dark" ? "dark" : "light");
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
