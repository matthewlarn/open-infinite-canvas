import { htmlInCanvasProvider, htmlInCanvasSupport } from "./html-in-canvas.js";
import { svgProvider } from "./svg.js";
import type { PictureProvider } from "./types.js";

/**
 * The default provider. It uses HTML in Canvas where the browser has it and SVG everywhere else.
 *
 * If an HTML in Canvas picture fails once, every later picture is made with SVG. So a browser with a broken or
 * half-finished build of the proposal still gets pictures, and Safari and Firefox never try it at all.
 *
 * @param options.preferHtmlInCanvas Set to false to always use SVG. Defaults to true.
 */
export function autoProvider(options: { preferHtmlInCanvas?: boolean } = {}): PictureProvider {
  const svg = svgProvider();
  const hic = htmlInCanvasProvider();
  let useHic = (options.preferHtmlInCanvas ?? true) && htmlInCanvasSupport() !== null;
  return {
    get name() {
      return useHic ? hic.name : svg.name;
    },
    async capture(request, scale) {
      if (useHic && !request.el?.querySelector(":scope > iframe")) {
        try {
          return await hic.capture(request, scale);
        } catch {
          useHic = false;
        }
      }
      return svg.capture(request, scale);
    },
    async captureMany(requests, scale) {
      if (useHic) {
        const t0 = performance.now();
        const pictures = [];
        for (const r of requests) pictures.push((await this.capture(r, scale)).picture);
        return { pictures, timings: { serializeMs: 0, decodeMs: 0, drawMs: 0, totalMs: performance.now() - t0, svgBytes: 0 } };
      }
      return svg.captureMany!(requests, scale);
    },
  };
}
