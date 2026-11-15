import type { FrameSpec, Rect } from "./types.js";

/** A direction for arrow key travel between frames. */
export type Direction = "left" | "right" | "up" | "down";

/**
 * The index of the nearest rectangle from `from` in a direction, or -1.
 *
 * Straight ahead beats nearer but off to the side: the score is the distance along the direction plus three
 * times the distance across it.
 */
export function neighbourIndex(rects: readonly Rect[], from: number, dir: Direction): number {
  const origin = rects[from];
  if (!origin) return -1;
  const fx = origin.x + origin.w / 2;
  const fy = origin.y + origin.h / 2;
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < rects.length; i++) {
    if (i === from) continue;
    const f = rects[i];
    const dx = f.x + f.w / 2 - fx;
    const dy = f.y + f.h / 2 - fy;
    const along = dir === "left" ? -dx : dir === "right" ? dx : dir === "up" ? -dy : dy;
    const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    if (along <= 0) continue;
    const score = along + across * 3;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/**
 * Frame ids in reading order: rows from top to bottom, then left to right inside a row. The order a sighted
 * reader would take, and the order a screen reader is given.
 */
export function readingOrder(frames: readonly FrameSpec[]): string[] {
  const sorted = [...frames].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: FrameSpec[][] = [];
  for (const f of sorted) {
    const row = rows[rows.length - 1];
    /* Same row if it starts before the row's first frame is half way down. */
    if (row && f.y < row[0].y + row[0].h / 2) row.push(f);
    else rows.push([f]);
  }
  return rows.flatMap((r) => r.sort((a, b) => a.x - b.x).map((f) => f.id));
}

/** Options for {@link layoutRows}. */
export type LayoutRowsOptions = {
  /** Space between frames in a row, in world pixels. Defaults to 80. */
  gapX?: number;
  /** Space between rows, in world pixels. Defaults to 140, which leaves room for names. */
  gapY?: number;
  /** A row wraps before it grows wider than this. Defaults to a width that makes the world roughly 16:10. */
  maxRowWidth?: number;
};

/**
 * Places frames in rows, left to right, wrapping at `maxRowWidth`. A new `group` starts a new row.
 *
 * A pure function. Positions are worked out from the sizes given and nothing is measured from the DOM.
 *
 * @returns New frame objects with `x` and `y` filled in, in the order given.
 */
export function layoutRows<T extends Omit<FrameSpec, "x" | "y">>(specs: readonly T[], options: LayoutRowsOptions = {}): (T & { x: number; y: number })[] {
  const gapX = options.gapX ?? 80;
  const gapY = options.gapY ?? 140;
  let area = 0;
  let widest = 0;
  for (const s of specs) {
    area += (s.w + gapX) * (s.h + gapY);
    if (s.w > widest) widest = s.w;
  }
  const maxRowWidth = Math.max(widest, options.maxRowWidth ?? Math.sqrt(area * 1.6));
  const out: (T & { x: number; y: number })[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let group: string | undefined;
  specs.forEach((s, i) => {
    const wraps = x > 0 && (x + s.w > maxRowWidth || (i > 0 && s.group !== group));
    if (wraps) {
      x = 0;
      y += rowHeight + gapY;
      rowHeight = 0;
    }
    out.push({ ...s, x, y });
    x += s.w + gapX;
    if (s.h > rowHeight) rowHeight = s.h;
    group = s.group;
  });
  return out;
}
