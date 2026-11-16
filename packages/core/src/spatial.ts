import type { Rect } from "./types.js";

/**
 * A uniform grid over world space. Each cell lists the frames that touch it.
 *
 * A grid beats a tree here. Frames move rarely, a query is a handful of cell lookups, and an update is two set
 * operations. Atlassian reached the same choice for its whiteboard and rejected quad trees for the rebuild cost.
 */
export class GridIndex {
  private cells = new Map<number, number[]>();
  private rects: readonly Rect[] = [];
  private stamp: Uint32Array = new Uint32Array(0);
  private tick = 0;

  /** @param cell The side of one grid cell in world pixels. A few screens wide works well. */
  constructor(private cell = 2048) {}

  private key(cx: number, cy: number) {
    /* Two 16 bit halves. Good for a world of plus or minus 67 million pixels at the default cell size. */
    return ((cx + 32768) << 16) | ((cy + 32768) & 0xffff);
  }

  /** Replaces the contents. The index keeps the array and reads rectangles from it by position. */
  load(rects: readonly Rect[]) {
    this.cells.clear();
    this.rects = rects;
    this.stamp = new Uint32Array(rects.length);
    for (let i = 0; i < rects.length; i++) this.add(i, rects[i]);
  }

  private add(i: number, r: Rect) {
    const c = this.cell;
    const x0 = Math.floor(r.x / c);
    const x1 = Math.floor((r.x + r.w) / c);
    const y0 = Math.floor(r.y / c);
    const y1 = Math.floor((r.y + r.h) / c);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const k = this.key(cx, cy);
        const list = this.cells.get(k);
        if (list) list.push(i);
        else this.cells.set(k, [i]);
      }
    }
  }

  /** Indexes of every frame that touches `q`, written into `out`. Returns the count. */
  query(q: Rect, out: number[]): number {
    const c = this.cell;
    const x0 = Math.floor(q.x / c);
    const x1 = Math.floor((q.x + q.w) / c);
    const y0 = Math.floor(q.y / c);
    const y1 = Math.floor((q.y + q.h) / c);
    const t = ++this.tick;
    let n = 0;
    /* A query wider than the world would walk millions of empty cells. Walk the cells that exist instead. */
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > this.cells.size * 2) {
      for (const list of this.cells.values()) n = this.collect(list, q, t, out, n);
      return n;
    }
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const list = this.cells.get(this.key(cx, cy));
        if (list) n = this.collect(list, q, t, out, n);
      }
    }
    return n;
  }

  private collect(list: number[], q: Rect, t: number, out: number[], n: number) {
    for (let j = 0; j < list.length; j++) {
      const i = list[j];
      if (this.stamp[i] === t) continue;
      this.stamp[i] = t;
      const r = this.rects[i];
      if (r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y) out[n++] = i;
    }
    return n;
  }

  /** The side of one cell in world pixels. */
  get cellSize(): number {
    return this.cell;
  }

  /** Every cell that holds at least one rectangle, as a world rectangle. For debugging overlays. */
  cellRects(): Rect[] {
    const out: Rect[] = [];
    const c = this.cell;
    for (const k of this.cells.keys()) {
      const cx = (k >>> 16) - 32768;
      const cy = (k & 0xffff) - 32768;
      out.push({ x: cx * c, y: cy * c, w: c, h: c });
    }
    return out;
  }

  /** The topmost frame under a world point, or -1. Later frames sit above earlier ones. */
  hit(wx: number, wy: number): number {
    const list = this.cells.get(this.key(Math.floor(wx / this.cell), Math.floor(wy / this.cell)));
    if (!list) return -1;
    let best = -1;
    for (const i of list) {
      const r = this.rects[i];
      if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h && i > best) best = i;
    }
    return best;
  }
}
