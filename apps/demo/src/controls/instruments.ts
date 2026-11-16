import type { CanvasEngine, EngineStats, Tier } from "open-infinite-canvas";

/* ------------------------------------------------------------ live stats */

/** What the stats readout shows. Engine counters plus what the page itself measures. */
export type LiveStats = {
  fps: number;
  frameMsAvg: number;
  frameMsMax: number;
  /** Tasks over 50ms in the last second, and since the page opened. Null where the browser cannot report them. */
  longTasks: number | null;
  longTasksTotal: number | null;
  /** Used JS heap in MB. Null outside Chromium. */
  heapMb: number | null;
  domNodes: number;
  engine: EngineStats;
};

/**
 * Samples the page once a second: frames painted, the time between them, long tasks, heap and DOM size. A
 * requestAnimationFrame loop runs while it is started, so it costs a little itself.
 */
export class StatsSampler {
  private raf = 0;
  private last = 0;
  private deltas: number[] = [];
  private longNow = 0;
  private longTotal = 0;
  private observer: PerformanceObserver | null = null;
  private timer = 0;
  private longSupported = typeof PerformanceObserver !== "undefined" && (PerformanceObserver.supportedEntryTypes ?? []).includes("longtask");

  constructor(
    private engine: CanvasEngine,
    private onSample: (s: LiveStats) => void,
  ) {}

  start() {
    if (this.timer) return;
    if (this.longSupported) {
      this.observer = new PerformanceObserver((list) => {
        const n = list.getEntries().length;
        this.longNow += n;
        this.longTotal += n;
      });
      this.observer.observe({ type: "longtask" });
    }
    const loop = (t: number) => {
      if (this.last) this.deltas.push(t - this.last);
      this.last = t;
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.timer = window.setInterval(() => this.sample(), 1000);
    this.sample();
  }

  stop() {
    cancelAnimationFrame(this.raf);
    clearInterval(this.timer);
    this.observer?.disconnect();
    this.observer = null;
    this.timer = 0;
    this.last = 0;
  }

  setEngine(engine: CanvasEngine) {
    this.engine = engine;
  }

  private sample() {
    const d = this.deltas;
    const sum = d.reduce((a, b) => a + b, 0);
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    this.onSample({
      fps: sum > 0 ? Math.round((d.length * 1000) / sum) : 0,
      frameMsAvg: d.length ? sum / d.length : 0,
      frameMsMax: d.length ? Math.max(...d) : 0,
      longTasks: this.longSupported ? this.longNow : null,
      longTasksTotal: this.longSupported ? this.longTotal : null,
      heapMb: memory ? memory.usedJSHeapSize / 1048576 : null,
      domNodes: document.getElementsByTagName("*").length,
      engine: this.engine.stats(),
    });
    this.deltas = [];
    this.longNow = 0;
  }
}

/* ------------------------------------------------------------ overlay */

export type OverlayFlags = { tiers: boolean; hitBoxes: boolean; cells: boolean };

/** Tier colours. Picked to tell apart on the light and the dark canvas, and named in the panel's legend. */
export const TIER_COLOURS: Record<Tier, string> = {
  live: "#1f9d55",
  parked: "#d98e04",
  staging: "#8e44c9",
  picture: "#2f6fd6",
  placeholder: "#8a8780",
};

/**
 * Draws debugging marks over the canvas: every frame tinted by its tier, the box a click is tested against,
 * and the cells of the spatial index. Redrawn each animation frame while any of them is on.
 */
export class DebugOverlay {
  private raf = 0;
  private pointer: { x: number; y: number } | null = null;
  private flags: OverlayFlags = { tiers: false, hitBoxes: false, cells: false };

  constructor(
    private canvas: HTMLCanvasElement,
    private getEngine: () => CanvasEngine | null,
  ) {}

  setPointer(p: { x: number; y: number } | null) {
    this.pointer = p;
  }

  set(flags: OverlayFlags) {
    this.flags = flags;
    const on = flags.tiers || flags.hitBoxes || flags.cells;
    if (on && !this.raf) this.raf = requestAnimationFrame(this.draw);
    if (!on) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.clear();
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private clear() {
    const ctx = this.canvas.getContext("2d");
    ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private draw = () => {
    this.raf = requestAnimationFrame(this.draw);
    const engine = this.getEngine();
    const { canvas } = this;
    const ctx = canvas.getContext("2d");
    if (!engine || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cam = engine.getCamera();
    const sx = (x: number) => x * cam.z + cam.x;
    const sy = (y: number) => y * cam.z + cam.y;
    const inView = (x: number, y: number, fw: number, fh: number) => x + fw >= 0 && y + fh >= 0 && x <= w && y <= h;
    ctx.font = "600 14px system-ui, -apple-system, 'Segoe UI', sans-serif";

    if (this.flags.cells) {
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#c2410c";
      ctx.fillStyle = "#c2410c";
      for (const c of engine.debugCells()) {
        const x = sx(c.x);
        const y = sy(c.y);
        const s = c.w * cam.z;
        if (!inView(x, y, s, s)) continue;
        ctx.strokeRect(x, y, s, s);
        if (s > 120) ctx.fillText(`cell ${Math.round(c.x / c.w)}, ${Math.round(c.y / c.h)}`, x + 6, y + 18);
      }
      ctx.setLineDash([]);
    }

    const hit = this.pointer ? engine.frameAt(this.pointer.x, this.pointer.y) : null;
    for (const f of engine.frames) {
      const x = sx(f.x);
      const y = sy(f.y);
      const fw = f.w * cam.z;
      const fh = f.h * cam.z;
      if (!inView(x, y, fw, fh)) continue;
      if (this.flags.tiers) {
        const colour = TIER_COLOURS[f.tier];
        ctx.globalAlpha = 0.32;
        ctx.fillStyle = colour;
        ctx.fillRect(x, y, fw, fh);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = colour;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, fw - 2, fh - 2);
        if (fw > 70) {
          const label = f.tier;
          const tw = ctx.measureText(label).width;
          /* White on near black reads on any tint. The swatch carries the colour. */
          ctx.fillStyle = "rgba(0,0,0,0.82)";
          ctx.fillRect(x + 4, y + 4, tw + 32, 24);
          ctx.fillStyle = colour;
          ctx.fillRect(x + 10, y + 10, 12, 12);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(label, x + 28, y + 21);
        }
      }
      if (this.flags.hitBoxes) {
        const isHit = hit?.index === f.index;
        ctx.setLineDash(isHit ? [] : [3, 3]);
        ctx.lineWidth = isHit ? 3 : 1;
        ctx.strokeStyle = isHit ? "#dc2626" : "#6b7280";
        ctx.strokeRect(x, y, fw, fh);
        ctx.setLineDash([]);
      }
    }
    if (this.flags.hitBoxes && this.pointer) {
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.arc(this.pointer.x, this.pointer.y, 4, 0, Math.PI * 2);
      ctx.fill();
      const text = hit ? `hit: ${hit.name}` : "hit: empty canvas";
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(this.pointer.x + 10, this.pointer.y + 8, tw + 12, 24);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, this.pointer.x + 16, this.pointer.y + 25);
    }
  };
}

/* ------------------------------------------------------------ benchmark */

export type BenchmarkResult = {
  durationMs: number;
  frames: number;
  fps: number;
  frameMsP50: number;
  frameMsP95: number;
  frameMsMax: number;
  /** Frames that took longer than 50ms. */
  slowFrames: number;
  longTasks: number | null;
  promotions: number;
  farDraws: number;
  engineTickMsAvg: number;
};

const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r));
const ease = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2;

/**
 * A scripted pan and zoom sweep, run in the page. The camera is moved once per animation frame, so the result
 * measures what a smooth gesture costs on this machine.
 *
 *   1. Fit every screen, then wait for the view to settle.
 *   2. Zoom from the fitted view into the centre, to 60%, over 1.5 seconds.
 *   3. Pan sideways across 3 viewport widths and back, over 3 seconds.
 *   4. Zoom back out to the fitted view, over 1.5 seconds.
 */
export async function runBenchmark(engine: CanvasEngine, onProgress?: (label: string) => void): Promise<BenchmarkResult> {
  const longSupported = typeof PerformanceObserver !== "undefined" && (PerformanceObserver.supportedEntryTypes ?? []).includes("longtask");
  let longTasks = 0;
  const observer = longSupported ? new PerformanceObserver((l) => (longTasks += l.getEntries().length)) : null;

  onProgress?.("Fitting every screen");
  engine.fit(undefined, { animate: false });
  await new Promise((r) => setTimeout(r, 600));
  const { w, h } = engine.getViewport();
  const start = engine.getCamera();
  const zIn = Math.max(start.z, 0.6);
  /* The world point at the centre of the view stays put while zooming. */
  const cx = (w / 2 - start.x) / start.z;
  const cy = (h / 2 - start.y) / start.z;
  const at = (z: number, panPx = 0) => ({ z, x: w / 2 - cx * z + panPx, y: h / 2 - cy * z });

  const phases: { label: string; ms: number; cam: (t: number) => { x: number; y: number; z: number } }[] = [
    { label: "Zooming in", ms: 1500, cam: (t) => at(Math.exp(Math.log(start.z) + (Math.log(zIn) - Math.log(start.z)) * ease(t))) },
    { label: "Panning", ms: 3000, cam: (t) => at(zIn, -Math.sin(Math.PI * t) * w * 3) },
    { label: "Zooming out", ms: 1500, cam: (t) => at(Math.exp(Math.log(zIn) + (Math.log(start.z) - Math.log(zIn)) * ease(t))) },
  ];

  const before = engine.stats();
  engine.resetTickStats();
  observer?.observe({ type: "longtask" });
  const deltas: number[] = [];
  let last = await nextFrame();
  const t0 = last;
  for (const phase of phases) {
    onProgress?.(phase.label);
    const p0 = last;
    for (;;) {
      const t = Math.min(1, (last - p0) / phase.ms);
      engine.setCamera(phase.cam(t));
      if (t >= 1) break;
      const now = await nextFrame();
      deltas.push(now - last);
      last = now;
    }
  }
  observer?.disconnect();
  const after = engine.stats();
  const sorted = [...deltas].sort((a, b) => a - b);
  const pick = (q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : 0);
  const durationMs = last - t0;
  return {
    durationMs,
    frames: deltas.length,
    fps: durationMs > 0 ? (deltas.length * 1000) / durationMs : 0,
    frameMsP50: pick(0.5),
    frameMsP95: pick(0.95),
    frameMsMax: sorted[sorted.length - 1] ?? 0,
    slowFrames: deltas.filter((d) => d > 50).length,
    longTasks: longSupported ? longTasks : null,
    promotions: after.promotions - before.promotions,
    farDraws: after.farDraws,
    engineTickMsAvg: after.tickMsAvg,
  };
}
