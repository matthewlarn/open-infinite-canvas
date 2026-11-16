import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasEngine } from "../src/engine";
import { LodScheduler, mountBudget, type LodFrame } from "../src/lod";
import { GridIndex } from "../src/spatial";
import { DEFAULT_INPUT, DEFAULT_LOD, type Tier } from "../src/types";
import type { PictureProvider } from "../src/pictures/types";

/* The engine runs unmounted here. It only needs timers and animation frames to exist. */
beforeEach(() => {
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const stubProvider = (name: string): PictureProvider => ({
  name,
  capture: () => Promise.reject(new Error("not used")),
});

describe("CanvasEngine.getOptions", () => {
  it("reports the defaults when nothing is given", () => {
    const engine = new CanvasEngine({ reducedMotion: false, provider: stubProvider("svg") });
    const o = engine.getOptions();
    expect(o.lod).toEqual(DEFAULT_LOD);
    expect(o.input).toEqual(DEFAULT_INPUT);
    expect(o).toMatchObject({ provider: "svg", minZoom: 0.02, maxZoom: 64, willChange: "gesture", warmup: true, origin: "floating", reducedMotion: false, followsSystemMotion: false, maxPixelRatio: 0, farLayer: true, pictureSmoothing: "auto", farZoomSlack: 1.12, contentVisibility: true });
  });

  it("returns copies, so changing them does not change the engine", () => {
    const engine = new CanvasEngine({ reducedMotion: false });
    engine.getOptions().lod.maxLive = 1;
    expect(engine.cfg.maxLive).toBe(24);
  });
});

describe("CanvasEngine.reconfigure", () => {
  it("changes only the fields given, in the same config object the scheduler reads", () => {
    const engine = new CanvasEngine({ reducedMotion: false });
    const cfg = engine.cfg;
    engine.reconfigure({ lod: { maxLive: 8, maxParked: 4, mountsStill: 3, stagingGroup: 2 } });
    expect(engine.cfg).toBe(cfg);
    expect(engine.getOptions().lod).toEqual({ ...DEFAULT_LOD, maxLive: 8, maxParked: 4, mountsStill: 3, stagingGroup: 2 });
  });

  it("pulls values into range", () => {
    const engine = new CanvasEngine({ reducedMotion: false });
    engine.reconfigure({ lod: { liveInScale: 0.3, liveOutScale: 0.5, maxLive: 7.6, captureConcurrency: 0, maxParked: -3, thumbScale: 0.05, tinyScale: 0.2 } });
    const lod = engine.getOptions().lod;
    expect(lod.liveOutScale).toBe(0.3);
    expect(lod.maxLive).toBe(8);
    expect(lod.captureConcurrency).toBe(1);
    expect(lod.maxParked).toBe(0);
    expect(lod.tinyScale).toBe(0.2);
    expect(lod.thumbScale).toBe(0.2);
    expect(lod.previewScale).toBe(0.5);
  });

  it("ignores numbers that are not finite", () => {
    const engine = new CanvasEngine({ reducedMotion: false });
    engine.reconfigure({ lod: { maxLive: Number.NaN, maxParked: Infinity } });
    expect(engine.cfg.maxLive).toBe(24);
    expect(engine.cfg.maxParked).toBe(24);
  });

  it("changes input settings in place and keeps them in range", () => {
    const engine = new CanvasEngine({ reducedMotion: false, input: { keyStep: 32 } });
    const input = engine.input;
    expect(input.keyStep).toBe(32);
    engine.reconfigure({ input: { wheel: "zoom", inertia: false, friction: 4, panButton: "right", spaceDrag: false, zoomSpeed: 0.02 } });
    expect(engine.input).toBe(input);
    expect(engine.getOptions().input).toEqual({ wheel: "zoom", zoomSpeed: 0.02, inertia: false, friction: 0.95, panButton: "right", spaceDrag: false, keyStep: 32 });
  });

  it("pulls the camera inside new zoom limits", () => {
    const engine = new CanvasEngine({ reducedMotion: false });
    engine.setCamera({ x: 0, y: 0, z: 1 });
    engine.reconfigure({ minZoom: 2, maxZoom: 8 });
    expect(engine.getCamera().z).toBe(2);
    engine.reconfigure({ maxZoom: 0.5 });
    /* The largest zoom is never below the smallest. */
    expect(engine.getOptions()).toMatchObject({ minZoom: 2, maxZoom: 2 });
    engine.reconfigure({ minZoom: 0.1, maxZoom: 0.5 });
    expect(engine.getCamera().z).toBe(0.5);
    engine.destroy();
  });

  it("switches reduced motion between a fixed value and the system setting", () => {
    let listeners = 0;
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: () => listeners++, removeEventListener: () => listeners-- }));
    const engine = new CanvasEngine({ reducedMotion: false });
    expect(engine.reducedMotion).toBe(false);
    engine.reconfigure({ reducedMotion: null });
    expect(engine.getOptions()).toMatchObject({ reducedMotion: true, followsSystemMotion: true });
    expect(listeners).toBe(1);
    engine.reconfigure({ reducedMotion: false });
    expect(engine.getOptions()).toMatchObject({ reducedMotion: false, followsSystemMotion: false });
    expect(listeners).toBe(0);
  });

  it("swaps the picture provider and the rendering switches", () => {
    const engine = new CanvasEngine({ reducedMotion: false, provider: stubProvider("svg") });
    engine.reconfigure({ provider: stubProvider("screenshot"), warmup: false, willChange: "never", origin: "fixed", maxPixelRatio: 1.5, farLayer: false, pictureSmoothing: "off", farZoomSlack: 1, contentVisibility: false });
    expect(engine.getOptions()).toMatchObject({ provider: "screenshot", warmup: false, willChange: "never", origin: "fixed", maxPixelRatio: 1.5, farLayer: false, pictureSmoothing: "off", farZoomSlack: 1.01, contentVisibility: false });
  });
});

describe("configurable budgets", () => {
  it("mountBudget reads its numbers from the config", () => {
    const cfg = { mountsStill: 5, mountsMoving: 3, lateFrameMs: 40 };
    expect(mountBudget(false, 100, cfg)).toBe(5);
    expect(mountBudget(true, 39, cfg)).toBe(3);
    expect(mountBudget(true, 41, cfg)).toBe(0);
  });

  it("the scheduler reads a changed config on its next pass", () => {
    const frames: LodFrame[] = Array.from({ length: 6 }, (_, i) => ({ x: i * 473, y: 0, w: 393, h: 852, tier: "picture" as Tier, prio: 0, lastLiveAt: 0 }));
    const cfg = { ...DEFAULT_LOD, mountsStill: 1 };
    const lod = new LodScheduler(cfg, frames);
    const input = { cam: { x: 0, y: 0, z: 0.5 }, vw: 1440, vh: 900, visible: [0, 1, 2, 3, 4, 5], visibleCount: 6, selected: -1, moving: false, lastFrameMs: 16, now: 0 };
    lod.update(input);
    expect(lod.live.size).toBe(1);
    cfg.mountsStill = 4;
    lod.update(input);
    expect(lod.live.size).toBe(5);
    cfg.maxLive = 2;
    lod.update(input);
    expect(lod.live.size).toBe(2);
  });

  it("evicts as many parked frames a pass as evictionsPerFrame allows", () => {
    const frames: LodFrame[] = Array.from({ length: 10 }, (_, i) => ({ x: i * 473, y: 0, w: 393, h: 852, tier: "parked" as Tier, prio: 0, lastLiveAt: 0 }));
    const lod = new LodScheduler({ ...DEFAULT_LOD, maxParked: 0, evictionsPerFrame: 5 }, frames);
    lod.parked.push(...frames.map((_, i) => i));
    const input = { cam: { x: 0, y: 0, z: 0.1 }, vw: 1440, vh: 900, visible: [], visibleCount: 0, selected: -1, moving: false, lastFrameMs: 16, now: 0 };
    lod.update(input);
    expect(lod.parked.length).toBe(5);
  });
});

describe("GridIndex.cellRects", () => {
  it("lists every cell that holds a rectangle", () => {
    const grid = new GridIndex(100);
    grid.load([
      { x: 10, y: 10, w: 20, h: 20 },
      { x: 150, y: -50, w: 100, h: 20 },
    ]);
    const cells = grid.cellRects().sort((a, b) => a.x - b.x || a.y - b.y);
    expect(grid.cellSize).toBe(100);
    expect(cells).toEqual([
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 100, y: -100, w: 100, h: 100 },
      { x: 200, y: -100, w: 100, h: 100 },
    ]);
  });
});
