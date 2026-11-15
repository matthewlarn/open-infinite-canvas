import { fitRect, lerpCamera, unionRects, type Camera, type Rect } from "open-infinite-canvas";

/**
 * What every variant exposes to the benchmark. The same scripted camera path drives all of them through
 * `setCamera`, so the only thing that differs between runs is how the variant renders.
 */
export type BenchTarget = {
  variant: string;
  frames: Rect[];
  viewport: () => { w: number; h: number };
  setCamera: (cam: Camera) => void;
  getCamera: () => Camera;
  stats: () => Record<string, unknown>;
  /** True once background work has finished, for variants that have any. */
  idle: () => boolean;
  /** Starts the variant's own counters again, so `stats` after a path covers that path only. */
  resetStats?: () => void;
};

export type PathName = "zoom-sweep" | "pan-far" | "pan-mid" | "pan-near";

export type PathResult = {
  path: PathName;
  durationMs: number;
  frames: number;
  /** Milliseconds between consecutive animation frames. */
  deltas: number[];
  longTasks: { start: number; duration: number }[];
  startedAt: number;
  endedAt: number;
};

const longTasks: { start: number; duration: number }[] = [];
const longFrames: { start: number; duration: number; blocking: number }[] = [];

function observe() {
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) longTasks.push({ start: e.startTime, duration: e.duration });
    }).observe({ type: "longtask", buffered: true });
  } catch {
    /* Not supported. The count stays at zero and the report says so. */
  }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) longFrames.push({ start: e.startTime, duration: e.duration, blocking: (e as PerformanceEntry & { blockingDuration?: number }).blockingDuration ?? 0 });
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch {
    /* See above. */
  }
}

/** The frame nearest the middle of the world that is the size of a phone. The paths zoom and pan around it. */
function anchor(frames: Rect[]): Rect {
  const b = unionRects(frames);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h * 0.3;
  let best = frames[0];
  let bestD = Infinity;
  for (const f of frames) {
    if (f.w > 500) continue;
    const d = Math.hypot(f.x + f.w / 2 - cx, f.y + f.h / 2 - cy);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

const centred = (wx: number, wy: number, z: number, vw: number, vh: number): Camera => ({ z, x: vw / 2 - wx * z, y: vh / 2 - wy * z });

/** The camera at time `t` from 0 to 1 along a named path. Pure, so every variant sees the same motion. */
export function pathCamera(path: PathName, t: number, frames: Rect[], vw: number, vh: number): Camera {
  const bounds = unionRects(frames);
  const all = fitRect(bounds, vw, vh, 64, 0.02, 1);
  const a = anchor(frames);
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  switch (path) {
    case "zoom-sweep": {
      /* In from everything to one screen at 100%, then back out. */
      const near = centred(ax, ay, 1, vw, vh);
      const u = t < 0.5 ? t * 2 : (1 - t) * 2;
      return lerpCamera(all, near, u, vw, vh);
    }
    case "pan-far": {
      /* Zoomed out with dozens to hundreds of screens in view, corner to corner. */
      const z = Math.min(0.2, all.z * 1.8);
      const x0 = bounds.x + vw / 2 / z;
      const y0 = bounds.y + vh / 2 / z;
      const x1 = Math.max(x0, bounds.x + bounds.w - vw / 2 / z);
      const y1 = Math.max(y0, bounds.y + bounds.h - vh / 2 / z);
      return centred(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z, vw, vh);
    }
    case "pan-mid": {
      /* Half size. Twenty or so screens in view. Along a row and a little down it. */
      const span = 12 * (a.w + 80);
      const x0 = Math.max(bounds.x + vw, ax - span / 2);
      return centred(x0 + span * t, ay + a.h * 0.4 * t, 0.5, vw, vh);
    }
    case "pan-near": {
      /* Full size. Two or three screens in view. Across six of them. */
      const span = 6 * (a.w + 80);
      const x0 = ax - span / 2;
      return centred(x0 + span * t, ay, 1, vw, vh);
    }
  }
}

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

export async function runPath(target: BenchTarget, path: PathName, durationMs: number): Promise<PathResult> {
  const { w, h } = target.viewport();
  const deltas: number[] = [];
  /* Start at the path's first camera and let that settle, so the first frame is not a jump. */
  target.setCamera(pathCamera(path, 0, target.frames, w, h));
  await new Promise((r) => setTimeout(r, 700));
  target.resetStats?.();
  let prev = await nextFrame();
  const start = prev;
  const startedAt = performance.now();
  /* Marks show up in a browser trace, so a trace can be cut to exactly this path. */
  performance.mark("path-start");
  for (;;) {
    const now = await nextFrame();
    deltas.push(now - prev);
    prev = now;
    const t = (now - start) / durationMs;
    if (t >= 1) {
      target.setCamera(pathCamera(path, 1, target.frames, w, h));
      break;
    }
    target.setCamera(pathCamera(path, t, target.frames, w, h));
  }
  const endedAt = performance.now();
  performance.mark("path-end");
  /* Long task entries arrive a little after the task ends. */
  await new Promise((r) => setTimeout(r, 250));
  return {
    path,
    durationMs: prev - start,
    frames: deltas.length,
    deltas,
    longTasks: longTasks.filter((l) => l.start + l.duration >= startedAt && l.start <= endedAt),
    startedAt,
    endedAt,
  };
}

export type BenchApi = BenchTarget & {
  ready: boolean;
  readyAt: number;
  runPath: (path: PathName, durationMs: number) => Promise<PathResult>;
  pathCamera: (path: PathName, t: number) => Camera;
  longTasks: () => { start: number; duration: number }[];
  longFrames: () => { start: number; duration: number; blocking: number }[];
  domNodes: () => number;
  anchor: () => Rect;
  fitAll: () => Camera;
};

declare global {
  interface Window {
    __bench?: BenchApi;
  }
}

let observed = false;

/** Publishes a variant to the benchmark as `window.__bench`. `readyWhen` delays the ready mark, for variants that load more after the first paint. */
export function publishBench(target: BenchTarget, readyWhen?: Promise<void>) {
  if (!observed) {
    observed = true;
    observe();
  }
  const api: BenchApi = {
    ...target,
    ready: false,
    readyAt: 0,
    runPath: (path, durationMs) => runPath(target, path, durationMs),
    pathCamera: (path, t) => {
      const { w, h } = target.viewport();
      return pathCamera(path, t, target.frames, w, h);
    },
    longTasks: () => longTasks.slice(),
    longFrames: () => longFrames.slice(),
    domNodes: () => document.getElementsByTagName("*").length,
    anchor: () => anchor(target.frames),
    fitAll: () => {
      const { w, h } = target.viewport();
      return fitRect(unionRects(target.frames), w, h, 64, 0.02, 1);
    },
  };
  window.__bench = api;
  /* Two frames after publishing, the first paint has happened. */
  void (readyWhen ?? Promise.resolve()).then(() =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        api.ready = true;
        api.readyAt = performance.now();
      }),
    ),
  );
  return api;
}
