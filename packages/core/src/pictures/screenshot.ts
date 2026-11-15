import type { FrameSpec } from "../types.js";
import { pictureSize, toPicture, type Picture, type PictureProvider } from "./types.js";

/**
 * Loads an image file and turns it into a picture of a screen at `scale`.
 *
 * The image can be any size. It is drawn to fit the screen's rectangle, so a screenshot taken at twice the
 * screen's size gives a sharper picture and one taken at half size a softer one.
 */
export async function loadScreenshot(url: string, w: number, h: number, scale: number): Promise<Picture> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  const { pw, ph } = pictureSize(w, h, scale);
  return toPicture(img, pw, ph, scale);
}

export type ScreenshotProviderOptions = {
  /** The address of the screenshot for a frame. Return null if there is none, and the frame stays a placeholder. */
  url: (frame: FrameSpec) => string | null | undefined;
};

/**
 * Pictures from files made ahead of time, for example by a build step that screenshots every screen.
 *
 * Nothing is mounted to make a picture, so this is the cheapest provider at run time and it works in every
 * browser. The cost is that a picture shows the screen as it was when the file was made.
 *
 * A frame with its own `picture` address uses that file whatever provider the canvas has, so this provider is
 * only needed when the address is worked out from the frame.
 *
 * @example
 * createCanvas({ provider: screenshotProvider({ url: (frame) => `/shots/${frame.id}.png` }) });
 */
export function screenshotProvider(options: ScreenshotProviderOptions): PictureProvider {
  return {
    name: "screenshot",
    needsElement: false,
    async capture(request, scale) {
      const t0 = performance.now();
      const url = options.url(request.frame);
      if (!url) throw new Error(`No screenshot for frame "${request.frame.id}".`);
      const picture = await loadScreenshot(url, request.w, request.h, scale);
      return { picture, timings: { serializeMs: 0, decodeMs: 0, drawMs: 0, totalMs: performance.now() - t0, svgBytes: 0 } };
    },
  };
}
