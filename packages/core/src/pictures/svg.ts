import { pictureSize, toPicture, type CaptureTimings, type Picture, type PictureProvider, type PictureRequest } from "./types.js";

type CssCache = { text: string; sheets: number; rules: number };
const cssCache = new WeakMap<Document, CssCache>();

/** All CSS a document has loaded, as one string. Cached until the number of sheets or rules changes, or `invalidateCss` is called. */
export function pageCss(doc: Document = document): string {
  const sheets = doc.styleSheets;
  let rules = 0;
  for (let i = 0; i < sheets.length; i++) {
    try {
      rules += sheets[i].cssRules.length;
    } catch {
      /* A cross-origin sheet cannot be read. Its styles will be missing from the picture. */
    }
  }
  const cached = cssCache.get(doc);
  if (cached && cached.sheets === sheets.length && cached.rules === rules) return cached.text;
  const parts: string[] = [];
  for (let i = 0; i < sheets.length; i++) {
    try {
      const list = sheets[i].cssRules;
      for (let j = 0; j < list.length; j++) parts.push(list[j].cssText);
    } catch {
      /* See above. */
    }
  }
  /* A picture is one still frame. Motion would only cost time while the image is drawn. */
  parts.push("*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}");
  /* An SVG image draws scroll bars that never fade, where the page draws overlay ones or none. Leave them out. */
  parts.push("*{scrollbar-width:none!important}");
  /* "]]>" would end the CDATA section the CSS is embedded in. */
  const text = parts.join("\n").replaceAll("]]>", "]] >");
  cssCache.set(doc, { text, sheets: sheets.length, rules });
  return text;
}

/** Forgets the cached CSS. Call it after changing a rule in place, which the cache cannot see. */
export function invalidateCss(doc: Document = document): void {
  cssCache.delete(doc);
}

/** Copies what a clone loses: typed text, ticks, chosen options. */
function syncFormState(from: Element, to: Element) {
  const a = from.querySelectorAll<HTMLElement>("input, textarea, select");
  if (!a.length) return;
  const b = to.querySelectorAll<HTMLElement>("input, textarea, select");
  for (let i = 0; i < a.length && i < b.length; i++) {
    const src = a[i];
    const dst = b[i];
    const tag = src.tagName;
    if (tag === "INPUT") {
      const s = src as HTMLInputElement;
      if (s.type === "checkbox" || s.type === "radio") {
        if (s.checked) dst.setAttribute("checked", "");
        else dst.removeAttribute("checked");
      } else {
        dst.setAttribute("value", s.value);
      }
    } else if (tag === "TEXTAREA") {
      dst.textContent = (src as HTMLTextAreaElement).value;
    } else if (tag === "SELECT") {
      const s = src as HTMLSelectElement;
      const d = dst as HTMLSelectElement;
      for (let j = 0; j < d.options.length; j++) {
        if (j === s.selectedIndex) d.options[j].setAttribute("selected", "");
        else d.options[j].removeAttribute("selected");
      }
    }
  }
}

const escapeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * The `class` and `data-*` attributes of a document's root element, as markup. Themes are usually switched
 * there. Repeated on the picture's own root so the same selectors match inside it.
 */
function rootAttrs(doc: Document): string {
  let out = "";
  for (const a of Array.from(doc.documentElement.attributes)) {
    if (a.name === "class" || a.name.startsWith("data-")) out += ` ${a.name}="${escapeAttr(a.value)}"`;
  }
  return out;
}

const FRAME_STYLE = (w: number, h: number) => `position:static;left:auto;top:auto;width:${w}px;height:${h}px;transform:none;content-visibility:visible;display:block;contain:none;translate:none`;

/** A same-document screen, or the document inside a same-origin iframe screen, ready to copy. */
type Source = { root: HTMLElement; doc: Document; iframe: boolean };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Finds what to copy. A host whose screen is an iframe is copied from the iframe's own document, once it has loaded. */
async function sourceOf(el: HTMLElement): Promise<Source> {
  const frame = el.querySelector<HTMLIFrameElement>(":scope > iframe");
  if (!frame) return { root: el, doc: el.ownerDocument, iframe: false };
  const read = () => {
    try {
      return frame.contentDocument;
    } catch {
      return null;
    }
  };
  let doc = read();
  if (!doc) throw new Error("The iframe is on another origin, so its picture cannot be taken. Give the frame a `picture` instead.");
  if (doc.readyState !== "complete" || doc.location.href === "about:blank") {
    await Promise.race([new Promise<void>((r) => frame.addEventListener("load", () => r(), { once: true })), sleep(8000)]);
    doc = read();
    if (!doc || !doc.body) throw new Error("The iframe did not load, so its picture cannot be taken.");
  }
  /* The page inside usually renders a moment after it loads. */
  await sleep(80);
  return { root: doc.body, doc, iframe: true };
}

/** The copy of one screen as XHTML, ready to sit inside a `foreignObject`. */
function cloneAsXhtml(source: Source, w: number, h: number, serializer: XMLSerializer): string {
  const clone = source.root.cloneNode(true) as HTMLElement;
  syncFormState(source.root, clone);
  if (source.iframe) {
    /* A copied <body> becomes a plain block the size of the screen. Scripts must not run again inside the picture. */
    clone.querySelectorAll("script").forEach((s) => s.remove());
    const html = serializer.serializeToString(clone).replace(/^<body/, "<div").replace(/<\/body>$/, "</div>");
    return `<div style="width:${w}px;height:${h}px;overflow:hidden">${html}</div>`;
  }
  /* The copy is drawn at the origin, whatever the original's place or state on the canvas. */
  clone.removeAttribute("inert");
  /* A parked frame's content is hidden with an inline `display: none`. The picture must show it. */
  for (let i = 0; i < clone.children.length; i++) (clone.children[i] as HTMLElement).style?.removeProperty("display");
  clone.style.cssText = FRAME_STYLE(w, h);
  return serializer.serializeToString(clone);
}

async function decode(svg: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await img.decode();
  return img;
}

async function captureOne(request: PictureRequest, scale: number): Promise<{ picture: Picture; timings: CaptureTimings }> {
  if (!request.el) throw new Error("The SVG provider needs the screen to be mounted.");
  const t0 = performance.now();
  const { w, h } = request;
  const source = await sourceOf(request.el);
  const attrs = rootAttrs(source.doc);
  const { pw, ph } = pictureSize(w, h, scale);
  /* Viewport units inside the picture measure the image itself. An iframe's page is sized by its viewport, so
     its image is given the screen's full size and scaled as it is drawn. */
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${source.iframe ? w : pw}" height="${source.iframe ? h : ph}" viewBox="0 0 ${w} ${h}"${attrs}>` +
    `<foreignObject x="0" y="0" width="${w}" height="${h}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml"${attrs} style="width:${w}px;height:${h}px;overflow:hidden">` +
    `<style><![CDATA[${pageCss(source.doc)}]]></style>${cloneAsXhtml(source, w, h, new XMLSerializer())}</div></foreignObject></svg>`;
  const t1 = performance.now();
  const img = await decode(svg);
  const t2 = performance.now();
  const picture = toPicture(img, pw, ph, scale);
  const t3 = performance.now();
  return { picture, timings: { serializeMs: t1 - t0, decodeMs: t2 - t1, drawMs: t3 - t2, totalMs: t3 - t0, svgBytes: svg.length } };
}

/**
 * Several screens in one SVG image, side by side.
 *
 * Most of the cost of a picture is fixed: the browser builds a whole hidden page for each SVG image and parses
 * the stylesheet again. One image for several screens pays that once. The image is drawn once and cut up.
 */
async function captureBatch(requests: PictureRequest[], scale: number): Promise<{ pictures: Picture[]; timings: CaptureTimings }> {
  const t0 = performance.now();
  const doc = requests[0].el!.ownerDocument;
  const attrs = rootAttrs(doc);
  const serializer = new XMLSerializer();
  const gap = 8;
  let x = 0;
  let height = 0;
  const parts: string[] = [];
  const offsets: number[] = [];
  for (const it of requests) {
    offsets.push(x);
    parts.push(
      `<foreignObject x="${x}" y="0" width="${it.w}" height="${it.h}"><div xmlns="http://www.w3.org/1999/xhtml"${attrs} style="width:${it.w}px;height:${it.h}px;overflow:hidden">${cloneAsXhtml({ root: it.el!, doc, iframe: false }, it.w, it.h, serializer)}</div></foreignObject>`,
    );
    x += it.w + gap;
    if (it.h > height) height = it.h;
  }
  const width = x - gap;
  const stripW = Math.max(1, Math.round(width * scale));
  const stripH = Math.max(1, Math.round(height * scale));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${stripW}" height="${stripH}" viewBox="0 0 ${width} ${height}"${attrs}>` + `<style><![CDATA[${pageCss(doc)}]]></style>${parts.join("")}</svg>`;
  const t1 = performance.now();
  const img = await decode(svg);
  const t2 = performance.now();
  /* Draw the whole strip once, then cut each screen out of it. Cutting is a plain bitmap copy. */
  const strip = toPicture(img, stripW, stripH, scale);
  const pictures = requests.map((it, i) => {
    const { pw, ph } = pictureSize(it.w, it.h, scale);
    return toPicture(strip.bitmap, pw, ph, scale, Math.round(offsets[i] * scale), 0, pw, ph);
  });
  strip.bitmap.close();
  const t3 = performance.now();
  return { pictures, timings: { serializeMs: t1 - t0, decodeMs: t2 - t1, drawMs: t3 - t2, totalMs: t3 - t0, svgBytes: svg.length } };
}

const isIframeHost = (el: HTMLElement | null) => !!el?.querySelector(":scope > iframe");

/**
 * Pictures made by copying the screen and the page's CSS into an SVG image, which the browser then draws.
 *
 * This is the fallback that needs nothing from the browser beyond SVG `foreignObject`. Fidelity is good, not
 * exact. It cannot see cross-origin images, canvas pixels, video frames, web fonts that are not inlined, or
 * the inside of a cross-origin iframe. A same-origin iframe screen is copied from its own document.
 *
 * Several screens are drawn in one image, because the page's stylesheet is embedded in every image and that is
 * most of the cost.
 */
export function svgProvider(): PictureProvider {
  return {
    name: "svg",
    capture: captureOne,
    async captureMany(requests, scale) {
      const t0 = performance.now();
      const plain = requests.filter((r) => !isIframeHost(r.el));
      const out = new Map<PictureRequest, Picture>();
      let timings: CaptureTimings = { serializeMs: 0, decodeMs: 0, drawMs: 0, totalMs: 0, svgBytes: 0 };
      try {
        if (plain.length) {
          const batch = await captureBatch(plain, scale);
          timings = batch.timings;
          plain.forEach((r, i) => out.set(r, batch.pictures[i]));
        }
        for (const r of requests) if (!out.has(r)) out.set(r, (await captureOne(r, scale)).picture);
      } catch (e) {
        for (const p of out.values()) p.bitmap.close();
        throw e;
      }
      return { pictures: requests.map((r) => out.get(r)!), timings: { ...timings, totalMs: performance.now() - t0 } };
    },
  };
}
