import type { FrameSpec } from "../types.js";

/** One bitmap of a screen. `scale` is its size relative to the screen's layout size. */
export type Picture = { bitmap: ImageBitmap; w: number; h: number; scale: number; bytes: number };

/** Where the time for one picture went. Providers that cannot tell fill in `totalMs` and leave the rest at zero. */
export type CaptureTimings = { serializeMs: number; decodeMs: number; drawMs: number; totalMs: number; svgBytes: number };

/** What a provider is asked to draw. */
export type PictureRequest = {
  frame: FrameSpec;
  /** The mounted host element of the screen. Null for a provider that set `needsElement` to false. */
  el: HTMLElement | null;
  /** The screen's layout size in CSS pixels. */
  w: number;
  h: number;
};

export type PictureResult = { picture: Picture; timings: CaptureTimings };

/**
 * Makes a picture of a screen. The engine does not care how.
 *
 * Three ship with the package: {@link htmlInCanvasProvider}, {@link svgProvider} and {@link screenshotProvider}.
 * {@link autoProvider} picks between the first two. A consumer can write its own.
 */
export interface PictureProvider {
  readonly name: string;
  /**
   * False when the provider can make a picture without the screen being mounted, for example from a file.
   * The engine then never mounts a screen just to picture it. Defaults to true.
   */
  readonly needsElement?: boolean;
  /** One picture at `scale` times the screen's layout size. Reject to leave the frame as a placeholder. */
  capture(request: PictureRequest, scale: number): Promise<PictureResult>;
  /** Optional. Several screens in one go, for providers where that is cheaper than one at a time. */
  captureMany?(requests: PictureRequest[], scale: number): Promise<{ pictures: Picture[]; timings: CaptureTimings }>;
}

/**
 * Asks for a canvas kept in ordinary memory. Without this, a browser with a GPU gives every small canvas its own
 * texture, and hundreds of pictures become hundreds of textures the browser cannot drop. Kept in ordinary memory,
 * a picture is uploaded when it is first drawn and the browser manages that copy itself.
 */
export const PLAIN_MEMORY: CanvasRenderingContext2DSettings = { willReadFrequently: true };

/** Draws any image source into a new bitmap of exactly `pw` by `ph` pixels, held in ordinary memory. */
export function toPicture(source: CanvasImageSource, pw: number, ph: number, scale: number, sx?: number, sy?: number, sw?: number, sh?: number): Picture {
  const off = new OffscreenCanvas(pw, ph);
  const ctx = off.getContext("2d", PLAIN_MEMORY)!;
  if (sx === undefined) ctx.drawImage(source, 0, 0, pw, ph);
  else ctx.drawImage(source, sx, sy!, sw!, sh!, 0, 0, pw, ph);
  return { bitmap: off.transferToImageBitmap(), w: pw, h: ph, scale, bytes: pw * ph * 4 };
}

/** A picture's pixel size for a screen of `w` by `h` at `scale`. Never smaller than one pixel. */
export const pictureSize = (w: number, h: number, scale: number) => ({ pw: Math.max(1, Math.round(w * scale)), ph: Math.max(1, Math.round(h * scale)) });
