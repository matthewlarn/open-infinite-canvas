import { pictureSize, toPicture, type PictureProvider } from "./types.js";

type DrawElementContext = CanvasRenderingContext2D & {
  drawElement?: (el: Element, x: number, y: number, w?: number, h?: number) => void;
  drawElementImage?: (el: Element, x: number, y: number, w?: number, h?: number) => void;
};

/**
 * Whether this browser has a drawing call from the HTML in Canvas proposal, and which one.
 *
 * `drawElementImage` is the name in the current proposal. `drawElement` is the name in the first flagged
 * builds of Chromium. Null means neither, which is every browser without the flag at the time of writing.
 */
export function htmlInCanvasSupport(): "drawElementImage" | "drawElement" | null {
  if (typeof CanvasRenderingContext2D === "undefined") return null;
  const proto = CanvasRenderingContext2D.prototype as DrawElementContext;
  if (typeof proto.drawElementImage === "function") return "drawElementImage";
  if (typeof proto.drawElement === "function") return "drawElement";
  return null;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Copies what a clone loses: typed text, ticks, chosen options. */
function syncFormState(from: Element, to: Element) {
  const a = from.querySelectorAll<HTMLElement>("input, textarea, select");
  const b = to.querySelectorAll<HTMLElement>("input, textarea, select");
  for (let i = 0; i < a.length && i < b.length; i++) {
    const src = a[i] as HTMLInputElement;
    const dst = b[i] as HTMLInputElement;
    if (src.tagName === "SELECT") (dst as unknown as HTMLSelectElement).selectedIndex = (src as unknown as HTMLSelectElement).selectedIndex;
    else if (src.type === "checkbox" || src.type === "radio") dst.checked = src.checked;
    else dst.value = src.value;
  }
}

/**
 * Pictures painted by the browser itself, through the HTML in Canvas proposal.
 *
 * The browser paints real elements into a canvas, so the picture matches the page: fonts, images and all.
 * The proposal only draws an element that is a child of the canvas. So this provider puts a copy of the screen
 * inside a hidden canvas, in the same document and under the same CSS, lets the browser lay it out, and draws
 * that. The screen itself is never moved.
 *
 * Experimental. The proposal is behind a flag in Chromium and absent elsewhere, and its names have changed
 * once already. `capture` rejects where the call is missing. Use {@link autoProvider} to fall back to SVG.
 *
 * In current builds the canvas is marked as tainted after the call, so the pixels cannot be read back or
 * saved. The engine only draws pictures, so that does not matter to it.
 */
export function htmlInCanvasProvider(): PictureProvider {
  return {
    name: "html-in-canvas",
    async capture(request, scale) {
      const kind = htmlInCanvasSupport();
      if (!kind) throw new Error("This browser has no HTML in Canvas drawing call.");
      const { el, w, h } = request;
      if (!el) throw new Error("The HTML in Canvas provider needs the screen to be mounted.");
      if (el.querySelector(":scope > iframe")) throw new Error("An iframe screen cannot be copied into a canvas.");
      const t0 = performance.now();
      const doc = el.ownerDocument;
      const canvas = doc.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.setAttribute("layoutsubtree", "");
      canvas.setAttribute("aria-hidden", "true");
      /* Behind the page and out of reach, but still laid out and painted, which the drawing call needs. */
      canvas.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px;z-index:-2147483647;pointer-events:none;contain:strict`;
      const copy = el.cloneNode(true) as HTMLElement;
      syncFormState(el, copy);
      copy.removeAttribute("inert");
      copy.removeAttribute("data-mode");
      copy.inert = true;
      for (let i = 0; i < copy.children.length; i++) (copy.children[i] as HTMLElement).style?.removeProperty("display");
      copy.style.cssText = `position:static;left:auto;top:auto;width:${w}px;height:${h}px;transform:none;content-visibility:visible;display:block;contain:none;translate:none`;
      canvas.appendChild(copy);
      doc.body.appendChild(canvas);
      try {
        await nextFrame();
        await nextFrame();
        const t1 = performance.now();
        const ctx = canvas.getContext("2d") as DrawElementContext;
        ctx[kind]!(copy, 0, 0);
        const { pw, ph } = pictureSize(w, h, scale);
        const bitmap = await createImageBitmap(canvas, { resizeWidth: pw, resizeHeight: ph, resizeQuality: "high" });
        const picture = toPicture(bitmap, pw, ph, scale);
        bitmap.close();
        const t2 = performance.now();
        return { picture, timings: { serializeMs: t1 - t0, decodeMs: 0, drawMs: t2 - t1, totalMs: t2 - t0, svgBytes: 0 } };
      } finally {
        canvas.remove();
      }
    },
  };
}
