import type { Camera } from "./types.js";
import type { Picture } from "./pictures/types.js";

/** What the far layer needs to know about a frame. The engine owns these objects and mutates them in place. */
export type FarFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  /** Three sizes of the same picture. `tiny` is always kept once taken. The other two are a bounded cache. */
  tiny: Picture | null;
  thumb: Picture | null;
  preview: Picture | null;
  /** True once the live DOM for this frame has been painted. */
  liveShown: boolean;
};

/** The colours the far canvas draws with. A canvas cannot read CSS, so they are passed in. */
export type FarColors = {
  /** The background of the canvas. */
  canvas: string;
  /** The fill of a placeholder. */
  surface: string;
  /** The hairline round every frame. */
  border: string;
  /** Frame names. */
  label: string;
  /** The selection ring. */
  accent: string;
  /** The bars inside a placeholder. */
  skeleton: string;
};

/**
 * Draws every visible frame that is not live as a bitmap on one canvas a little larger than the viewport.
 *
 * The cost of a frame is one `drawImage`, whatever the screen it pictures contains. Memory is fixed by the
 * viewport, not by the world. Nothing here creates a compositor layer per frame.
 *
 * The canvas is drawn with a margin all round (the overscan). Between drawings the engine moves and scales the
 * canvas element itself, which the compositor does without the main thread. It is only drawn again when that
 * would uncover an edge, stretch the picture too far, or show something that has changed.
 */
export class FarRenderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private vw = 0;
  private vh = 0;
  /** Extra CSS pixels drawn on every side of the viewport. */
  private overscan = 0;
  colors: FarColors = { canvas: "#f2f2f0", surface: "#ffffff", border: "#c9c9c4", label: "#4a4a45", accent: "#1f1f1c", skeleton: "#e4e4df" };
  /** Frames drawn as pictures or placeholders in the last draw. Read by the benchmark. */
  lastDrawn = { pictures: 0, placeholders: 0, labels: 0 };

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d", { alpha: false })!;
  }

  resize(vw: number, vh: number, dpr: number, overscan: number) {
    this.vw = vw;
    this.vh = vh;
    this.dpr = dpr;
    this.overscan = overscan;
    const cw = vw + overscan * 2;
    const ch = vh + overscan * 2;
    const bw = Math.max(1, Math.round(cw * dpr));
    const bh = Math.max(1, Math.round(ch * dpr));
    if (this.canvas.width !== bw) this.canvas.width = bw;
    if (this.canvas.height !== bh) this.canvas.height = bh;
    const s = this.canvas.style;
    s.left = `${-overscan}px`;
    s.top = `${-overscan}px`;
    s.width = `${cw}px`;
    s.height = `${ch}px`;
  }

  /** @param quality How pictures are smoothed when they are scaled. `off` draws hard pixels. */
  draw(cam: Camera, frames: FarFrame[], visible: number[], count: number, selected: number, quality: "high" | "low" | "off") {
    const { ctx, dpr } = this;
    const z = cam.z;
    /* Everything below is in viewport coordinates. The transform shifts it into the larger canvas. */
    const o = this.overscan;
    ctx.setTransform(dpr, 0, 0, dpr, o * dpr, o * dpr);
    ctx.fillStyle = this.colors.canvas;
    ctx.fillRect(-o, -o, this.vw + o * 2, this.vh + o * 2);
    ctx.imageSmoothingEnabled = quality !== "off";
    ctx.imageSmoothingQuality = quality === "high" ? "high" : "low";

    /* Device pixels the picture must supply for each CSS pixel of the frame. */
    const need = z * dpr;
    let pictures = 0;
    let placeholders = 0;
    let labels = 0;
    const snap = (v: number) => Math.round(v * dpr) / dpr;

    for (let n = 0; n < count; n++) {
      const f = frames[visible[n]];
      const sx = snap(f.x * z + cam.x);
      const sy = snap(f.y * z + cam.y);
      const sw = Math.max(1 / dpr, snap(f.w * z));
      const sh = Math.max(1 / dpr, snap(f.h * z));
      /* Every frame in view is drawn, live or not. A live screen sits above this canvas and covers its own
         picture, so the canvas never has to be drawn again just because a screen came alive or was parked. */
      {
        /* The smallest picture that is not stretched by more than a tenth. Failing that, the largest there is. */
        let pic: Picture | null = f.tiny;
        if (f.thumb && (!pic || need > pic.scale * 1.1)) pic = f.thumb;
        if (f.preview && (!pic || need > pic.scale * 1.1)) pic = f.preview;
        if (pic) {
          ctx.drawImage(pic.bitmap, sx, sy, sw, sh);
          pictures++;
        } else {
          this.placeholder(sx, sy, sw, sh);
          placeholders++;
        }
      }
      /* A hairline round every frame, live or not, one device pixel wide at any zoom. It sits just outside the
         frame, so a live screen drawn above this canvas does not cover it. */
      ctx.strokeStyle = this.colors.border;
      ctx.lineWidth = 1 / dpr;
      ctx.strokeRect(sx - 0.5 / dpr, sy - 0.5 / dpr, sw + 1 / dpr, sh + 1 / dpr);
      if (visible[n] === selected) {
        ctx.strokeStyle = this.colors.accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx - 2, sy - 2, sw + 4, sh + 4);
      }
    }

    /* Names sit above their frame at one size on screen. Skipped when the frame is too narrow to hold one. */
    ctx.font = "500 14px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = this.colors.label;
    for (let n = 0; n < count; n++) {
      const f = frames[visible[n]];
      const sw = f.w * z;
      if (sw < 84) continue;
      const sx = snap(f.x * z + cam.x);
      const sy = snap(f.y * z + cam.y);
      if (sy < 4 - o) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(sx, sy - 24, sw, 24);
      ctx.clip();
      ctx.fillText(f.name, sx, sy - 8);
      ctx.restore();
      labels++;
    }
    this.lastDrawn = { pictures, placeholders, labels };
  }

  private placeholder(sx: number, sy: number, sw: number, sh: number) {
    const { ctx } = this;
    ctx.fillStyle = this.colors.surface;
    ctx.fillRect(sx, sy, sw, sh);
    if (sw < 28) return;
    /* A few bars, so an empty frame reads as a screen that is on its way and not as a hole. */
    ctx.fillStyle = this.colors.skeleton;
    const pad = sw * 0.08;
    ctx.fillRect(sx + pad, sy + pad, sw - pad * 2, Math.max(2, sh * 0.06));
    const line = Math.max(1, sh * 0.022);
    for (let i = 0; i < 5; i++) ctx.fillRect(sx + pad, sy + pad + sh * (0.14 + i * 0.07), (sw - pad * 2) * (i % 2 ? 0.62 : 0.86), line);
  }
}
