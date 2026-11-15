import { MAX_ZOOM, MIN_ZOOM, clamp, fitRect, lerpCamera, unionRects, viewRect, zoomAt } from "./camera.js";
import { FarRenderer, type FarColors, type FarFrame } from "./far-renderer.js";
import { LodScheduler } from "./lod.js";
import { autoProvider } from "./pictures/auto.js";
import { loadScreenshot } from "./pictures/screenshot.js";
import { PLAIN_MEMORY, type CaptureTimings, type Picture, type PictureProvider } from "./pictures/types.js";
import { neighbourIndex, type Direction } from "./layout.js";
import { GridIndex } from "./spatial.js";
import { DEFAULT_LOD, type Camera, type FrameSpec, type LodConfig, type Rect, type Tier } from "./types.js";

/** The far canvas is drawn again once the zoom has changed by this factor since it was last drawn. */
const FAR_ZOOM_SLACK = 1.12;

/** Most frames mounted at once only to have their picture taken. */
const STAGING_MAX = 8;
/** Most frames newly mounted for a picture in one animation frame. */
const STAGING_PER_FRAME = 4;
/** Pictures are taken together once this many are mounted. One image for several screens costs less than one each. */
const STAGING_GROUP = 4;
/** Most pictures being loaded from files at once. */
const STATIC_MAX = 6;

/** A frame as the engine holds it: the spec, plus its tier and its pictures. Read it, do not write to it. */
export type EngineFrame = FarFrame &
  FrameSpec & {
  index: number;
  tier: Tier;
  /** The host element, while the frame is mounted. */
  el: HTMLElement | null;
  /** When the frame last became live. Oldest parked frames are evicted first. */
  lastLiveAt: number;
  /** True when the picture no longer shows what the screen looks like. */
  dirty: boolean;
  capturing: boolean;
  /** True once a picture has been taken at least once. */
  captured: boolean;
  /** True once somebody has used the screen. Its build-time screenshot, if it has one, is then out of date. */
  touched: boolean;
  /** True if the frame's build-time screenshot could not be loaded. */
  staticFailed: boolean;
  /** True if the last attempt at a picture failed. */
  failed: boolean;
  prio: number;
};

/** One frame the view layer must keep mounted, and how. */
export type MountedFrame = { id: string; index: number; mode: "live" | "parked" | "staging" };

/** What the view layer must render. A new object each time it changes, so it can be compared by identity. */
export type Structure = { version: number; mounted: MountedFrame[] };

/** Options for {@link createCanvas}. Every one is optional. */
export type EngineOptions = {
  /** Budgets and thresholds. Anything left out comes from {@link DEFAULT_LOD}: 24 live, 24 parked. */
  lod?: Partial<LodConfig>;
  /** How pictures are made. Defaults to {@link autoProvider}: HTML in Canvas where the browser has it, SVG elsewhere. */
  provider?: PictureProvider;
  /** Colours for the far canvas. Can be changed later with `setColors`. */
  colors?: Partial<FarColors>;
  /** Called when a picture could not be made. The frame stays a placeholder. */
  onPictureError?: (frame: FrameSpec, error: unknown) => void;
  /**
   * When the live layer carries `will-change: transform`.
   * `gesture`: only while the camera moves, so the browser redraws sharp once it stops.
   */
  willChange?: "gesture" | "always" | "never";
  /** Take a picture of every frame in the background, nearest first. Defaults to true. */
  warmup?: boolean;
  /** `floating` (the default) keeps DOM coordinates small by moving the origin near the view. */
  origin?: "fixed" | "floating";
  /**
   * True to jump instead of gliding: no camera tween and no glide after a drag.
   * Left out, the engine follows the `prefers-reduced-motion` setting and keeps following it if it changes.
   */
  reducedMotion?: boolean;
  /** Smallest zoom. Defaults to 0.02, which is 2%. */
  minZoom?: number;
  /** Largest zoom. Defaults to 64, which is 6,400%. */
  maxZoom?: number;
};

/** Counters for tuning budgets and for benchmarks. Not needed to use the canvas. */
export type EngineStats = {
  frames: number;
  live: number;
  parked: number;
  staging: number;
  pictures: number;
  thumbs: number;
  previews: number;
  placeholders: number;
  pictureBytes: number;
  captures: number;
  captureMsAvg: number;
  captureMsP95: number;
  serializeMsAvg: number;
  decodeMsAvg: number;
  drawMsAvg: number;
  svgBytesAvg: number;
  promotions: number;
  demotions: number;
  evictions: number;
  warm: boolean;
  warmMs: number | null;
  /** True while a frame is scheduled, a picture is being taken, or a live screen has not painted yet. */
  busy: boolean;
  moving: boolean;
  zoom: number;
  drawn: { pictures: number; placeholders: number; labels: number };
  tickMsAvg: number;
  tickMsMax: number;
  /** Engine frames since the counters were last reset, and how many of them drew the far canvas again. */
  engineFrames: number;
  farDraws: number;
};

/**
 * The engine. No framework. It owns the camera, decides how alive every frame is, and draws the far layer.
 *
 * A view layer asks `getStructure()` which frames to mount, and tells the engine the element of each one with
 * `attach`. The engine never renders a screen itself. `@open-infinite-canvas/react` is one view layer and
 * {@link mountCanvas} is another, in plain DOM.
 *
 * Make one with {@link createCanvas}.
 */
export class CanvasEngine {
  /** The level of detail settings in force. */
  readonly cfg: LodConfig;
  /** Every frame, in the order they were given. */
  readonly frames: EngineFrame[] = [];
  private byId = new Map<string, EngineFrame>();
  private index = new GridIndex();
  private far: FarRenderer | null = null;
  private viewport: HTMLElement | null = null;
  private world: HTMLElement | null = null;
  private provider: PictureProvider;
  private opts: Required<Pick<EngineOptions, "willChange" | "warmup" | "origin" | "minZoom" | "maxZoom">>;
  private lod: LodScheduler<EngineFrame>;
  private reduced = false;
  private motionQuery: MediaQueryList | null = null;
  private onMotionChange = () => {
    this.reduced = !!this.motionQuery?.matches;
  };
  private colors: Partial<FarColors> | undefined;
  private onPictureError: EngineOptions["onPictureError"];

  private cam: Camera = { x: 0, y: 0, z: 1 };
  private vw = 1;
  private vh = 1;
  private dpr = 1;
  private originX = 0;
  private originY = 0;

  private visible: number[] = [];
  private visibleCount = 0;
  private staging = new Set<number>();
  private thumbs = new Set<number>();
  private previews = new Set<number>();
  private selected = -1;

  private raf = 0;
  private moving = false;
  private settleTimer = 0;
  private tween = 0;
  private lastFrameAt = 0;
  private lastFrameMs = 0;
  /** The camera the far canvas was last drawn for, and whether what it shows has changed since. */
  private farCam: Camera | null = null;
  private farDirty = true;
  private farDraws = 0;
  private frameCount = 0;
  private structure: Structure = { version: 0, mounted: [] };
  private listeners = new Set<() => void>();
  private settleListeners = new Set<(cam: Camera) => void>();
  private capturesInFlight = 0;
  private staticInFlight = 0;
  private warmOrder: number[] = [];
  private warmCursor = 0;
  private warmStart = 0;
  private warmDone: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private destroyed = false;

  private captureMs: number[] = [];
  private captureParts = { serialize: 0, decode: 0, draw: 0, svg: 0 };
  private tickMs = { sum: 0, n: 0, max: 0 };

  constructor(options: EngineOptions = {}) {
    this.cfg = { ...DEFAULT_LOD, ...options.lod };
    this.provider = options.provider ?? autoProvider();
    this.colors = options.colors;
    this.onPictureError = options.onPictureError;
    this.opts = {
      willChange: options.willChange ?? "gesture",
      warmup: options.warmup ?? true,
      origin: options.origin ?? "floating",
      minZoom: options.minZoom ?? MIN_ZOOM,
      maxZoom: options.maxZoom ?? MAX_ZOOM,
    };
    if (options.reducedMotion !== undefined) this.reduced = options.reducedMotion;
    else if (typeof matchMedia === "function") {
      this.motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
      this.reduced = this.motionQuery.matches;
      this.motionQuery.addEventListener?.("change", this.onMotionChange);
    }
    this.lod = new LodScheduler(this.cfg, this.frames, {
      onPromote: (i, from) => {
        if (from === "staging") this.staging.delete(i);
        this.frames[i].liveShown = false;
      },
      onDemote: (i) => {
        this.frames[i].liveShown = false;
      },
      onEvict: (i) => {
        const f = this.frames[i];
        /* The last chance to record what the screen looked like. The copy is made now, the drawing happens later. */
        if (f.el && (f.dirty || !f.captured) && !f.capturing) void this.capture(i);
        return f.tiny || f.capturing ? "picture" : "placeholder";
      },
    });
  }

  /** True when the camera jumps instead of gliding. */
  get reducedMotion(): boolean {
    return this.reduced;
  }

  /* ------------------------------------------------------------------ setup */

  /**
   * Connects the engine to the page.
   *
   * @param viewport The element that clips the canvas and receives every gesture.
   * @param world An empty element inside the viewport. The view layer mounts screens into it and the engine transforms it.
   * @param canvas A canvas inside the viewport, before `world`. The engine draws pictures on it.
   */
  mount(viewport: HTMLElement, world: HTMLElement, canvas: HTMLCanvasElement) {
    this.viewport = viewport;
    this.world = world;
    this.far = new FarRenderer(canvas);
    if (this.colors) this.far.colors = { ...this.far.colors, ...this.colors };
    this.measure();
    this.resizeObserver = new ResizeObserver(() => {
      this.measure();
      this.invalidate();
    });
    this.resizeObserver.observe(viewport);
    if (this.opts.willChange === "always") world.style.willChange = "transform";
    this.invalidate();
  }

  /** Stops every timer and frees every picture. The engine cannot be used afterwards. */
  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.tween);
    clearTimeout(this.settleTimer);
    this.resizeObserver?.disconnect();
    this.motionQuery?.removeEventListener?.("change", this.onMotionChange);
    this.listeners.clear();
    this.settleListeners.clear();
    for (const f of this.frames) {
      f.tiny?.bitmap.close();
      f.thumb?.bitmap.close();
      f.preview?.bitmap.close();
    }
  }

  private measure() {
    if (!this.viewport || !this.far) return;
    this.vw = Math.max(1, this.viewport.clientWidth);
    this.vh = Math.max(1, this.viewport.clientHeight);
    this.dpr = window.devicePixelRatio || 1;
    this.far.resize(this.vw, this.vh, this.dpr, this.cfg.marginPx);
    this.farDirty = true;
  }

  /** Changes the colours the far canvas draws with, for example after a theme change. */
  setColors(colors: Partial<FarColors>) {
    this.colors = { ...this.colors, ...colors };
    if (this.far) this.far.colors = { ...this.far.colors, ...colors };
    this.repaint();
  }

  /** What the far canvas shows has changed. Draw it again on the next frame. */
  private repaint() {
    this.farDirty = true;
    this.invalidate();
  }

  /** Replaces every frame. Tiers and pictures start again. */
  setFrames(specs: readonly FrameSpec[]) {
    for (const f of this.frames) {
      f.tiny?.bitmap.close();
      f.thumb?.bitmap.close();
      f.preview?.bitmap.close();
    }
    this.selected = -1;
    this.frames.length = 0;
    this.byId.clear();
    specs.forEach((s, index) => {
      const f: EngineFrame = {
        ...s,
        index,
        tier: "placeholder",
        el: null,
        tiny: null,
        thumb: null,
        preview: null,
        liveShown: false,
        lastLiveAt: 0,
        dirty: false,
        capturing: false,
        captured: false,
        touched: false,
        staticFailed: false,
        failed: false,
        prio: 0,
      };
      this.frames.push(f);
      this.byId.set(s.id, f);
    });
    this.index.load(this.frames);
    this.lod.reset();
    this.staging.clear();
    this.thumbs.clear();
    this.previews.clear();
    this.warmOrder.length = 0;
    this.warmCursor = 0;
    this.warmDone = null;
    this.warmStart = performance.now();
    this.publish();
    this.repaint();
  }

  /** Drops every picture, for example after a theme change. They are taken again in the background. */
  invalidatePictures() {
    for (const f of this.frames) {
      f.tiny?.bitmap.close();
      f.thumb?.bitmap.close();
      f.preview?.bitmap.close();
      f.tiny = null;
      f.thumb = null;
      f.preview = null;
      f.captured = false;
      f.dirty = false;
      f.failed = false;
      if (f.tier === "picture") f.tier = "placeholder";
    }
    this.thumbs.clear();
    this.previews.clear();
    this.warmOrder.length = 0;
    this.warmCursor = 0;
    this.warmDone = null;
    this.warmStart = performance.now();
    this.repaint();
  }

  /* ----------------------------------------------------------------- camera */

  /** A copy of the current camera. */
  getCamera(): Camera {
    return { ...this.cam };
  }
  /** The viewport size in CSS pixels, and the device pixel ratio. */
  getViewport() {
    return { w: this.vw, h: this.vh, dpr: this.dpr };
  }
  /** The smallest rectangle that holds every frame. */
  getBounds(): Rect {
    return unionRects(this.frames);
  }

  /** Moves the camera at once, with no animation. */
  setCamera(cam: Camera) {
    this.stopTween();
    this.moveTo(cam);
  }

  private moveTo(cam: Camera) {
    const z = clamp(cam.z, this.opts.minZoom, this.opts.maxZoom);
    if (z === this.cam.z && cam.x === this.cam.x && cam.y === this.cam.y) return;
    this.cam = { x: cam.x, y: cam.y, z };
    if (!this.moving) {
      this.moving = true;
      if (this.world && this.opts.willChange === "gesture") this.world.style.willChange = "transform";
    }
    clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => this.settle(), this.cfg.settleMs);
    this.invalidate();
  }

  /** Pans by a distance in screen pixels. */
  panBy(dx: number, dy: number) {
    this.stopTween();
    this.moveTo({ x: this.cam.x + dx, y: this.cam.y + dy, z: this.cam.z });
  }

  /** Zooms to `z`, keeping the world point under the screen point (`sx`, `sy`) where it is. */
  zoomAtPoint(z: number, sx: number, sy: number) {
    this.stopTween();
    this.moveTo(zoomAt(this.cam, z, sx, sy, this.opts.minZoom, this.opts.maxZoom));
  }

  /** Fits a world rectangle in the viewport. With no rectangle, fits every frame and never zooms past 100%. */
  fit(rect?: Rect, options: { padding?: number; animate?: boolean; maxZoom?: number } = {}) {
    const r = rect ?? this.getBounds();
    const target = fitRect(r, this.vw, this.vh, options.padding ?? 64, this.opts.minZoom, options.maxZoom ?? (rect ? this.opts.maxZoom : 1));
    this.animateTo(target, options.animate ?? true);
  }

  /** Fits one frame in the viewport, at 100% at most. The frame comes alive once the camera arrives. */
  fitFrame(id: string, options: { animate?: boolean } = {}) {
    const f = this.byId.get(id);
    if (f) this.fit(f, { padding: 48, maxZoom: 1, animate: options.animate });
  }

  /** Glides to a camera over about a quarter of a second. Jumps if `animate` is false or reduced motion is on. */
  animateTo(target: Camera, animate = true) {
    this.stopTween();
    if (!animate || this.reduced) {
      this.moveTo(target);
      return;
    }
    const from = { ...this.cam };
    const start = performance.now();
    const duration = 260;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      this.moveTo(lerpCamera(from, target, e, this.vw, this.vh));
      this.tween = t < 1 ? requestAnimationFrame(step) : 0;
    };
    this.tween = requestAnimationFrame(step);
  }

  private stopTween() {
    if (this.tween) cancelAnimationFrame(this.tween);
    this.tween = 0;
  }

  /** Calls back each time the camera has been still for `settleMs`. Returns a function that stops the calls. */
  onSettle(cb: (cam: Camera) => void) {
    this.settleListeners.add(cb);
    return () => this.settleListeners.delete(cb);
  }

  private settle() {
    if (this.destroyed) return;
    this.moving = false;
    /* Whole device pixels, so text at 100% lands on the pixel grid. */
    const snap = (v: number) => Math.round(v * this.dpr) / this.dpr;
    this.cam = { x: snap(this.cam.x), y: snap(this.cam.y), z: this.cam.z };
    if (this.world && this.opts.willChange === "gesture") this.world.style.willChange = "auto";
    this.rebase();
    this.trimPictures();
    this.buildWarmOrder();
    /* Drawn again at the true scale and at high quality now that nothing is moving. */
    this.repaint();
    for (const cb of this.settleListeners) cb({ ...this.cam });
  }

  /**
   * Moves the DOM origin next to the view. A frame's `left` is then a small number however far out in the world
   * it is, so the browser's 1/64 pixel layout grid and 32 bit transforms never show.
   */
  private rebase() {
    if (this.opts.origin !== "floating") return;
    const tx = this.cam.x + this.originX * this.cam.z;
    const ty = this.cam.y + this.originY * this.cam.z;
    if (Math.abs(tx) < 50_000 && Math.abs(ty) < 50_000) return;
    this.originX = Math.round((this.vw / 2 - this.cam.x) / this.cam.z);
    this.originY = Math.round((this.vh / 2 - this.cam.y) / this.cam.z);
    for (const f of this.frames) if (f.el) this.place(f);
  }

  private place(f: EngineFrame) {
    if (!f.el) return;
    f.el.style.left = `${f.x - this.originX}px`;
    f.el.style.top = `${f.y - this.originY}px`;
  }

  /* ------------------------------------------------------------- frame loop */

  /** Asks for one more engine frame. Safe to call at any time. */
  invalidate() {
    if (this.raf || this.destroyed) return;
    this.raf = requestAnimationFrame((ts) => this.frame(ts));
  }

  private frame(ts: number) {
    this.raf = 0;
    if (!this.far || !this.world) return;
    const t0 = performance.now();
    this.lastFrameMs = this.lastFrameAt ? ts - this.lastFrameAt : 16.7;
    this.lastFrameAt = ts;

    const { cam } = this;
    const tx = cam.x + this.originX * cam.z;
    const ty = cam.y + this.originY * cam.z;
    this.world.style.transform = `translate(${tx}px, ${ty}px) scale(${cam.z})`;

    this.visibleCount = this.index.query(viewRect(cam, this.vw, this.vh, this.cfg.marginPx), this.visible);
    const more = this.updateLod(t0);
    const idle = !this.moving && this.pumpIdle(t0);
    this.frameCount++;

    /* The far canvas. Most frames only move it. It is drawn again when moving it would not be enough. */
    const drawn = this.farCam;
    const o = this.cfg.marginPx;
    const k = drawn ? cam.z / drawn.z : 1;
    let fx = 0;
    let fy = 0;
    let redraw = this.farDirty || !drawn || k > FAR_ZOOM_SLACK || k < 1 / FAR_ZOOM_SLACK;
    if (drawn && !redraw) {
      /* Where the old drawing has to sit to match the new camera, and whether it still covers the viewport. */
      fx = cam.x - k * drawn.x;
      fy = cam.y - k * drawn.y;
      if (fx - k * o > 0 || fy - k * o > 0 || fx + k * (this.vw + o) < this.vw || fy + k * (this.vh + o) < this.vh) redraw = true;
    }
    if (redraw) {
      this.far.draw(cam, this.frames, this.visible, this.visibleCount, this.selected, !this.moving);
      this.far.canvas.style.transform = "none";
      this.farCam = { ...cam };
      this.farDirty = false;
      this.farDraws++;
    } else {
      this.far.canvas.style.transform = `translate(${fx + o * (1 - k)}px, ${fy + o * (1 - k)}px) scale(${k})`;
    }

    const dt = performance.now() - t0;
    this.tickMs.sum += dt;
    this.tickMs.n++;
    if (dt > this.tickMs.max) this.tickMs.max = dt;
    if (more || idle) this.invalidate();
    else this.lastFrameAt = 0;
  }

  /* ------------------------------------------------------- level of detail */

  /** Runs the scheduler for this frame. Returns true if work is left. */
  private updateLod(now: number): boolean {
    const { changed, pending } = this.lod.update({
      cam: this.cam,
      vw: this.vw,
      vh: this.vh,
      visible: this.visible,
      visibleCount: this.visibleCount,
      selected: this.selected,
      moving: this.moving,
      lastFrameMs: this.lastFrameMs,
      now,
    });
    if (changed) this.publish();
    return pending;
  }

  /* ------------------------------------------------------- background work */

  /** One small unit of background work. Only runs while the camera is still. Returns true if more is waiting. */
  private pumpIdle(_now: number): boolean {
    const { frames } = this;
    let more = false;

    /* Finished staging frames leave the DOM. The rest wait to have their picture taken. */
    let changed = false;
    const ready: number[] = [];
    for (const i of [...this.staging]) {
      const f = frames[i];
      if (f.capturing) continue;
      if (f.captured && !f.dirty) {
        this.staging.delete(i);
        f.tier = "picture";
        changed = true;
      } else if (f.el) ready.push(i);
    }

    if (this.capturesInFlight < 2) {
      /* A live frame with no picture yet gets one. A stale picture waits until the frame stops being live, so
         nothing is copied while somebody is typing in it. */
      for (const i of this.lod.live) {
        const f = frames[i];
        if (f.el && f.liveShown && !f.capturing && !f.captured) {
          void this.capture(i);
          more = true;
          break;
        }
      }
      for (const i of this.lod.parked) {
        const f = frames[i];
        if (f.el && !f.capturing && (!f.captured || f.dirty)) {
          void this.capture(i);
          more = true;
          break;
        }
      }
    }

    /* Mount a few more frames that are owed a picture: first the ones the current zoom needs a sharper size
       for, then every frame that has none at all, nearest the view first. */
    let staged = 0;
    let loads = 0;
    while (this.staging.size < STAGING_MAX && staged < STAGING_PER_FRAME) {
      const next = this.nextToStage();
      if (next < 0) break;
      if (this.mountless(frames[next])) {
        /* A picture that comes from a file needs no mounted screen. A few are loaded at a time. */
        if (this.staticInFlight >= STATIC_MAX || ++loads > STAGING_PER_FRAME) {
          this.warmCursor = Math.max(0, this.warmCursor - 1);
          more = true;
          break;
        }
        void this.capture(next);
        continue;
      }
      frames[next].tier = "staging";
      /* Marks the frame as owed a picture. Without it a frame that already has a small one would be unmounted
         again before the sharper one was taken, and staged again on the next frame, for ever. */
      frames[next].dirty = true;
      this.staging.add(next);
      staged++;
      changed = true;
    }

    /* Take the pictures in one go once a group is mounted, or once nothing more is on its way. */
    if (ready.length && this.capturesInFlight < 1 && (ready.length >= STAGING_GROUP || staged === 0)) {
      void this.captureGroup(ready.slice(0, STAGING_MAX));
    }

    if (this.warmDone === null && this.opts.warmup && this.frames.length && this.frames.every((f) => f.captured)) {
      this.warmDone = performance.now() - this.warmStart;
    }
    if (changed) this.publish();
    return more || this.staging.size > 0 || this.capturesInFlight > 0;
  }

  /** The next frame to mount for a picture, or -1. */
  private nextToStage(): number {
    const { frames, cfg } = this;
    /* A size is only fetched when every visible frame can keep it. Otherwise it would be dropped and retaken forever. */
    const need = this.cam.z * this.dpr;
    const needPreview = need > cfg.thumbScale * 1.1 && this.cam.z < cfg.liveInScale + 0.2 && this.visibleCount <= cfg.maxPreviews;
    const needThumb = !needPreview && need > cfg.tinyScale * 1.1 && this.visibleCount <= cfg.maxThumbs;
    if (needPreview || needThumb) {
      let best = Infinity;
      let next = -1;
      for (let n = 0; n < this.visibleCount; n++) {
        const i = this.visible[n];
        const f = frames[i];
        if ((needPreview ? f.preview : f.thumb) || f.el || f.capturing || f.failed || f.tier !== "picture") continue;
        const d = Math.hypot((f.x + f.w / 2) * this.cam.z + this.cam.x - this.vw / 2, (f.y + f.h / 2) * this.cam.z + this.cam.y - this.vh / 2);
        if (d < best) {
          best = d;
          next = i;
        }
      }
      if (next >= 0) return next;
    }
    if (!this.opts.warmup || this.warmDone !== null) return -1;
    if (this.warmCursor >= this.warmOrder.length) this.buildWarmOrder();
    while (this.warmCursor < this.warmOrder.length) {
      const i = this.warmOrder[this.warmCursor++];
      const f = frames[i];
      if (!f.captured && !f.el && !f.capturing && f.tier === "placeholder") return i;
    }
    return -1;
  }

  /** Pictures of several mounted frames at once. Falls back to one at a time if the provider cannot. */
  private async captureGroup(indices: number[]) {
    const list = indices.filter((i) => this.frames[i].el && !this.frames[i].capturing);
    if (!list.length) return;
    if (list.length === 1 || !this.provider.captureMany) {
      for (const i of list) void this.capture(i);
      return;
    }
    for (const i of list) {
      this.frames[i].capturing = true;
      this.frames[i].dirty = false;
    }
    this.capturesInFlight++;
    const frames = this.frames;
    const targets = list.map((i) => frames[i]);
    try {
      const items = list.map((i) => ({ frame: this.frames[i], el: this.frames[i].el, w: this.frames[i].w, h: this.frames[i].h }));
      const { pictures, timings } = await this.provider.captureMany(items, this.cfg.previewScale);
      if (this.destroyed || list.some((i, k) => frames[i] !== targets[k])) {
        pictures.forEach((p) => p.bitmap.close());
        return;
      }
      pictures.forEach((picture, k) => this.store(list[k], picture));
      const n = list.length;
      for (let k = 0; k < n; k++) this.recordCapture({ serializeMs: timings.serializeMs / n, decodeMs: timings.decodeMs / n, drawMs: timings.drawMs / n, totalMs: timings.totalMs / n, svgBytes: timings.svgBytes / n });
    } catch (error) {
      if (!this.destroyed && list.every((i, k) => frames[i] === targets[k])) for (const i of list) this.fail(i, error);
    } finally {
      for (const f of targets) f.capturing = false;
      this.capturesInFlight--;
      this.invalidate();
    }
  }

  /** Keeps a new picture of a frame, in all three sizes. */
  private store(i: number, picture: Picture) {
    const f = this.frames[i];
    /* One drawing of the screen gives all three sizes. Each smaller one is the larger one halved. */
    const thumb = downscale(picture, this.cfg.thumbScale / this.cfg.previewScale, this.cfg.thumbScale);
    const tiny = downscale(thumb, this.cfg.tinyScale / this.cfg.thumbScale, this.cfg.tinyScale);
    f.tiny?.bitmap.close();
    f.thumb?.bitmap.close();
    f.preview?.bitmap.close();
    f.tiny = tiny;
    f.thumb = thumb;
    f.preview = picture;
    this.thumbs.add(i);
    this.previews.add(i);
    f.captured = true;
    f.failed = false;
    if (f.tier === "placeholder") f.tier = "picture";
    this.farDirty = true;
    if (this.previews.size > this.cfg.maxPreviews * 1.25 || this.thumbs.size > this.cfg.maxThumbs * 1.25) this.trimPictures();
  }

  private buildWarmOrder() {
    if (!this.opts.warmup) return;
    const cx = (this.vw / 2 - this.cam.x) / this.cam.z;
    const cy = (this.vh / 2 - this.cam.y) / this.cam.z;
    const todo: number[] = [];
    for (const f of this.frames) {
      if (f.captured) continue;
      f.prio = Math.hypot(f.x + f.w / 2 - cx, f.y + f.h / 2 - cy);
      todo.push(f.index);
    }
    todo.sort((a, b) => this.frames[a].prio - this.frames[b].prio);
    this.warmOrder = todo;
    this.warmCursor = 0;
  }

  /** True if this frame's picture can be made without mounting the screen. */
  private mountless(f: EngineFrame): boolean {
    /* A build-time screenshot is used until somebody has used the screen. After that the screen itself is pictured. */
    if (f.picture && !f.touched && !f.staticFailed) return true;
    return this.provider.needsElement === false;
  }

  private async capture(i: number) {
    const f = this.frames[i];
    const fromFile = this.mountless(f);
    if (f.capturing || (!fromFile && !f.el)) return;
    f.capturing = true;
    f.dirty = false;
    this.capturesInFlight++;
    if (fromFile) this.staticInFlight++;
    const useOwnFile = fromFile && !!f.picture && !f.touched && !f.staticFailed;
    try {
      let picture: Picture;
      if (useOwnFile) {
        const t0 = performance.now();
        picture = await loadScreenshot(f.picture!, f.w, f.h, this.cfg.previewScale);
        this.recordCapture({ serializeMs: 0, decodeMs: 0, drawMs: 0, totalMs: performance.now() - t0, svgBytes: 0 });
      } else {
        const result = await this.provider.capture({ frame: f, el: fromFile ? null : f.el, w: f.w, h: f.h }, this.cfg.previewScale);
        picture = result.picture;
        this.recordCapture(result.timings);
      }
      /* The frame list may have been replaced while the picture was being made. */
      if (this.destroyed || this.frames[i] !== f) {
        picture.bitmap.close();
        return;
      }
      this.store(i, picture);
    } catch (error) {
      if (this.destroyed || this.frames[i] !== f) return;
      /* A missing file is not the end. The frame is pictured from the screen itself instead. */
      if (useOwnFile && this.provider.needsElement !== false) {
        f.staticFailed = true;
        this.onPictureError?.(f, error);
      } else this.fail(i, error);
    } finally {
      f.capturing = false;
      this.capturesInFlight--;
      if (fromFile) this.staticInFlight--;
      this.invalidate();
    }
  }

  /** A picture could not be made. The frame keeps its placeholder, or its last picture, and is not tried again until it is used. */
  private fail(i: number, error: unknown) {
    const f = this.frames[i];
    f.captured = true;
    f.failed = true;
    this.onPictureError?.(f, error);
  }

  private recordCapture(t: CaptureTimings) {
    this.captureMs.push(t.totalMs);
    this.captureParts.serialize += t.serializeMs;
    this.captureParts.decode += t.decodeMs;
    this.captureParts.draw += t.drawMs;
    this.captureParts.svg += t.svgBytes;
  }

  /** Keeps the two larger picture sizes inside their budgets. Frames in view keep theirs. The farthest go first. */
  private trimPictures() {
    const cx = (this.vw / 2 - this.cam.x) / this.cam.z;
    const cy = (this.vh / 2 - this.cam.y) / this.cam.z;
    const inView = new Set<number>();
    for (let n = 0; n < this.visibleCount; n++) inView.add(this.visible[n]);
    /* A frame in view keeps a size only if the current zoom draws that size. Zoomed right out, nothing needs the sharp one. */
    const need = this.cam.z * this.dpr;
    const trim = (set: Set<number>, max: number, inUse: boolean, drop: (f: EngineFrame) => void) => {
      if (set.size <= max) return;
      const order = inUse ? [...set].filter((i) => !inView.has(i)) : [...set];
      for (const i of order) {
        const f = this.frames[i];
        f.prio = Math.hypot(f.x + f.w / 2 - cx, f.y + f.h / 2 - cy);
      }
      order.sort((a, b) => this.frames[b].prio - this.frames[a].prio);
      for (const i of order) {
        if (set.size <= max) break;
        drop(this.frames[i]);
        set.delete(i);
      }
    };
    trim(this.previews, this.cfg.maxPreviews, need > this.cfg.thumbScale * 1.1, (f) => {
      f.preview?.bitmap.close();
      f.preview = null;
    });
    trim(this.thumbs, this.cfg.maxThumbs, need > this.cfg.tinyScale * 1.1, (f) => {
      f.thumb?.bitmap.close();
      f.thumb = null;
    });
    this.farDirty = true;
  }

  /* --------------------------------------------------------- view contract */

  /** Calls back whenever the set of mounted frames changes. Returns a function that stops the calls. */
  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  /** Which frames the view layer must keep mounted right now, and in which mode. */
  getStructure = (): Structure => this.structure;

  private publish() {
    const mounted: MountedFrame[] = [];
    for (const i of this.lod.live) mounted.push({ id: this.frames[i].id, index: i, mode: "live" });
    for (const i of this.lod.parked) mounted.push({ id: this.frames[i].id, index: i, mode: "parked" });
    for (const i of this.staging) mounted.push({ id: this.frames[i].id, index: i, mode: "staging" });
    mounted.sort((a, b) => a.index - b.index);
    this.structure = { version: this.structure.version + 1, mounted };
    for (const cb of this.listeners) cb();
  }

  /** The view layer reports the host element of a mounted frame, or null when it unmounts. */
  attach(id: string, el: HTMLElement | null) {
    const f = this.byId.get(id);
    if (!f) return;
    f.el = el;
    if (el) this.place(f);
    this.invalidate();
  }

  /** The view layer reports that a live frame's DOM is committed. One frame later it has painted and covers its picture. */
  shown(id: string) {
    const f = this.byId.get(id);
    if (!f) return;
    requestAnimationFrame(() => {
      if (f.tier !== "live") return;
      f.liveShown = true;
      this.invalidate();
    });
  }

  /** A screen was used. Its picture is taken again when it stops being live. */
  touch(id: string) {
    const f = this.byId.get(id);
    if (!f) return;
    f.dirty = true;
    f.touched = true;
    f.failed = false;
  }

  /* -------------------------------------------------------------- queries */

  /** The topmost frame under a screen point, or null. */
  frameAt(sx: number, sy: number): EngineFrame | null {
    const i = this.index.hit((sx - this.cam.x) / this.cam.z, (sy - this.cam.y) / this.cam.z);
    return i >= 0 ? this.frames[i] : null;
  }

  /** A frame by id, or null. */
  get(id: string) {
    return this.byId.get(id) ?? null;
  }

  /** Selects a frame, or nothing. The selected frame gets a ring and always wins a live slot. */
  select(id: string | null) {
    this.selected = id ? (this.byId.get(id)?.index ?? -1) : -1;
    this.repaint();
  }

  /** The selected frame, or null. */
  getSelected() {
    return this.selected >= 0 ? this.frames[this.selected] : null;
  }

  /** Brings a frame fully into view if it is not already, without changing the zoom. */
  reveal(id: string) {
    const f = this.byId.get(id);
    if (!f) return;
    const { cam } = this;
    const pad = 48;
    const x0 = f.x * cam.z + cam.x;
    const y0 = f.y * cam.z + cam.y;
    const x1 = x0 + f.w * cam.z;
    const y1 = y0 + f.h * cam.z;
    let dx = 0;
    let dy = 0;
    if (x1 - x0 > this.vw - pad * 2) dx = this.vw / 2 - (x0 + x1) / 2;
    else if (x0 < pad) dx = pad - x0;
    else if (x1 > this.vw - pad) dx = this.vw - pad - x1;
    if (y1 - y0 > this.vh - pad * 2) dy = pad - y0;
    else if (y0 < pad) dy = pad - y0;
    else if (y1 > this.vh - pad) dy = this.vh - pad - y1;
    if (dx || dy) this.animateTo({ x: cam.x + dx, y: cam.y + dy, z: cam.z });
  }

  /** The nearest frame from `id` in a direction, for arrow key navigation. */
  neighbour(id: string, dir: Direction): EngineFrame | null {
    const from = this.byId.get(id);
    if (!from) return null;
    const i = neighbourIndex(this.frames, from.index, dir);
    return i >= 0 ? this.frames[i] : null;
  }

  /** True once every frame has had its first picture taken. */
  isWarm() {
    return this.warmDone !== null;
  }

  /** A snapshot of the engine's counters. */
  stats(): EngineStats {
    let pictures = 0;
    let thumbs = 0;
    let previews = 0;
    let placeholders = 0;
    let bytes = 0;
    for (const f of this.frames) {
      if (f.tiny) {
        pictures++;
        bytes += f.tiny.bytes;
      } else placeholders++;
      if (f.thumb) {
        thumbs++;
        bytes += f.thumb.bytes;
      }
      if (f.preview) {
        previews++;
        bytes += f.preview.bytes;
      }
    }
    const ms = [...this.captureMs].sort((a, b) => a - b);
    const n = ms.length || 1;
    return {
      frames: this.frames.length,
      live: this.lod.live.size,
      parked: this.lod.parked.length,
      staging: this.staging.size,
      pictures,
      thumbs,
      previews,
      placeholders,
      pictureBytes: bytes,
      captures: ms.length,
      captureMsAvg: ms.reduce((a, b) => a + b, 0) / n,
      captureMsP95: ms.length ? ms[Math.min(ms.length - 1, Math.floor(ms.length * 0.95))] : 0,
      serializeMsAvg: this.captureParts.serialize / n,
      decodeMsAvg: this.captureParts.decode / n,
      drawMsAvg: this.captureParts.draw / n,
      svgBytesAvg: this.captureParts.svg / n,
      ...this.lod.counters,
      warm: this.warmDone !== null,
      warmMs: this.warmDone,
      busy: this.raf !== 0 || this.moving || this.capturesInFlight > 0 || this.staging.size > 0 || [...this.lod.live].some((i) => !this.frames[i].liveShown),
      moving: this.moving,
      zoom: this.cam.z,
      drawn: this.far?.lastDrawn ?? { pictures: 0, placeholders: 0, labels: 0 },
      tickMsAvg: this.tickMs.n ? this.tickMs.sum / this.tickMs.n : 0,
      tickMsMax: this.tickMs.max,
      engineFrames: this.frameCount,
      farDraws: this.farDraws,
    };
  }

  /** Starts the frame counters again, so a measurement covers only what follows. */
  resetTickStats() {
    this.tickMs = { sum: 0, n: 0, max: 0 };
    this.frameCount = 0;
    this.farDraws = 0;
  }
}

function downscale(p: Picture, ratio: number, scale: number): Picture {
  const w = Math.max(1, Math.round(p.w * ratio));
  const h = Math.max(1, Math.round(p.h * ratio));
  const off = new OffscreenCanvas(w, h);
  const ctx = off.getContext("2d", PLAIN_MEMORY)!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(p.bitmap, 0, 0, w, h);
  return { bitmap: off.transferToImageBitmap(), w, h, scale, bytes: w * h * 4 };
}

/**
 * Makes an engine.
 *
 * @example
 * const canvas = createCanvas({ lod: { maxLive: 24, maxParked: 24 } });
 * canvas.mount(viewportEl, worldEl, farCanvasEl);
 * canvas.setFrames(frames);
 * canvas.subscribe(() => render(canvas.getStructure()));
 * canvas.fit();
 */
export function createCanvas(options: EngineOptions = {}): CanvasEngine {
  return new CanvasEngine(options);
}
