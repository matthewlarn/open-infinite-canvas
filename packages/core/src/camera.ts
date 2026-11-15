import type { Camera, Rect } from "./types.js";

/** The default smallest zoom: 2%. */
export const MIN_ZOOM = 0.02;
/** The default largest zoom: 6,400%. */
export const MAX_ZOOM = 64;

/** `v` held between `lo` and `hi`. */
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Zoom to `z`, keeping the world point under the screen point (cx, cy) where it is. */
export function zoomAt(cam: Camera, z: number, cx: number, cy: number, minZ = MIN_ZOOM, maxZ = MAX_ZOOM): Camera {
  const next = clamp(z, minZ, maxZ);
  const k = next / cam.z;
  return { x: cx - (cx - cam.x) * k, y: cy - (cy - cam.y) * k, z: next };
}

/** The camera that fits `rect` into a viewport of `vw` by `vh` with `pad` screen pixels around it. */
export function fitRect(rect: Rect, vw: number, vh: number, pad = 64, minZ = MIN_ZOOM, maxZ = MAX_ZOOM): Camera {
  const z = clamp(Math.min((vw - pad * 2) / rect.w, (vh - pad * 2) / rect.h), minZ, maxZ);
  return { z, x: (vw - rect.w * z) / 2 - rect.x * z, y: (vh - rect.h * z) / 2 - rect.y * z };
}

/** The part of the world a viewport of `vw` by `vh` shows, grown by `marginPx` screen pixels on every side. */
export function viewRect(cam: Camera, vw: number, vh: number, marginPx = 0): Rect {
  const m = marginPx / cam.z;
  return { x: -cam.x / cam.z - m, y: -cam.y / cam.z - m, w: vw / cam.z + m * 2, h: vh / cam.z + m * 2 };
}

/** The world point under a screen point. */
export const screenToWorld = (cam: Camera, sx: number, sy: number) => ({ x: (sx - cam.x) / cam.z, y: (sy - cam.y) / cam.z });
/** The screen point a world point is drawn at. */
export const worldToScreen = (cam: Camera, wx: number, wy: number) => ({ x: wx * cam.z + cam.x, y: wy * cam.z + cam.y });

/** True if two rectangles overlap. Touching edges do not count. */
export const intersects = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** The smallest rectangle that holds every rectangle given. A 1 by 1 rectangle at the origin if there are none. */
export function unionRects(rects: readonly Rect[]): Rect {
  if (!rects.length) return { x: 0, y: 0, w: 1, h: 1 };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rects) {
    if (r.x < x0) x0 = r.x;
    if (r.y < y0) y0 = r.y;
    if (r.x + r.w > x1) x1 = r.x + r.w;
    if (r.y + r.h > y1) y1 = r.y + r.h;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * The camera a fraction `t` of the way from `a` to `b`. Zoom moves in log space so the motion feels even, and
 * the world point at the centre of the viewport moves in a straight line.
 */
export function lerpCamera(a: Camera, b: Camera, t: number, vw: number, vh: number): Camera {
  const z = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * t);
  /* Interpolate the world point at the viewport centre, then rebuild the offset for the new zoom. */
  const ax = (vw / 2 - a.x) / a.z;
  const ay = (vh / 2 - a.y) / a.z;
  const bx = (vw / 2 - b.x) / b.z;
  const by = (vh / 2 - b.y) / b.z;
  const cx = ax + (bx - ax) * t;
  const cy = ay + (by - ay) * t;
  return { z, x: vw / 2 - cx * z, y: vh / 2 - cy * z };
}
