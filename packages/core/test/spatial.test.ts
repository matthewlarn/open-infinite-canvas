import { describe, expect, it } from "vitest";
import { GridIndex } from "../src/spatial";
import type { Rect } from "../src/types";

/** A small deterministic generator, so a failure can be repeated. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const brute = (rects: Rect[], q: Rect) => rects.flatMap((r, i) => (r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y ? [i] : []));

function query(index: GridIndex, q: Rect): number[] {
  const out: number[] = [];
  const n = index.query(q, out);
  return out.slice(0, n).sort((a, b) => a - b);
}

function grid(cols: number, rows: number): Rect[] {
  const rects: Rect[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) rects.push({ x: c * 473, y: r * 992, w: 393, h: 852 });
  return rects;
}

describe("GridIndex.query", () => {
  it("finds exactly the frames a brute force scan finds, on a regular layout", () => {
    const rects = grid(40, 25);
    const index = new GridIndex();
    index.load(rects);
    const rand = rng(7);
    for (let i = 0; i < 200; i++) {
      const q = { x: rand() * 20000 - 1000, y: rand() * 26000 - 1000, w: rand() * 6000 + 1, h: rand() * 4000 + 1 };
      expect(query(index, q)).toEqual(brute(rects, q));
    }
  });

  it("matches brute force for random rectangles of mixed sizes, negative coordinates included", () => {
    const rand = rng(42);
    const rects: Rect[] = [];
    for (let i = 0; i < 1500; i++) rects.push({ x: rand() * 80000 - 40000, y: rand() * 80000 - 40000, w: rand() * 5000 + 10, h: rand() * 5000 + 10 });
    const index = new GridIndex(1024);
    index.load(rects);
    for (let i = 0; i < 200; i++) {
      const q = { x: rand() * 90000 - 45000, y: rand() * 90000 - 45000, w: rand() * 20000 + 1, h: rand() * 20000 + 1 };
      expect(query(index, q)).toEqual(brute(rects, q));
    }
  });

  it("returns each frame once, even when it spans many cells", () => {
    const rects = [{ x: -5000, y: -5000, w: 20000, h: 20000 }];
    const index = new GridIndex(512);
    index.load(rects);
    expect(query(index, { x: 0, y: 0, w: 9000, h: 9000 })).toEqual([0]);
  });

  it("handles a query far wider than the world without walking empty cells", () => {
    const rects = grid(10, 10);
    const index = new GridIndex();
    index.load(rects);
    const started = performance.now();
    const found = query(index, { x: -1e9, y: -1e9, w: 2e9, h: 2e9 });
    expect(found.length).toBe(100);
    expect(performance.now() - started).toBeLessThan(100);
  });

  it("returns nothing for an empty region and for an empty index", () => {
    const index = new GridIndex();
    index.load(grid(5, 5));
    expect(query(index, { x: 1e6, y: 1e6, w: 100, h: 100 })).toEqual([]);
    index.load([]);
    expect(query(index, { x: 0, y: 0, w: 100, h: 100 })).toEqual([]);
  });

  it("does not report frames that only share a cell with the query", () => {
    const rects = [
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 1500, y: 1500, w: 100, h: 100 },
    ];
    const index = new GridIndex(2048);
    index.load(rects);
    expect(query(index, { x: 50, y: 50, w: 10, h: 10 })).toEqual([0]);
  });

  it("works far from the origin", () => {
    const far = 30_000_000;
    const rects = grid(20, 5).map((r) => ({ ...r, x: r.x + far, y: r.y + far }));
    const index = new GridIndex();
    index.load(rects);
    const q = { x: far + 400, y: far + 100, w: 1500, h: 1200 };
    expect(query(index, q)).toEqual(brute(rects, q));
    expect(query(index, q).length).toBeGreaterThan(0);
  });

  it("reuses the output array and reports the count", () => {
    const index = new GridIndex();
    index.load(grid(3, 1));
    const out = [99, 99, 99, 99, 99];
    const n = index.query({ x: 0, y: 0, w: 500, h: 10 }, out);
    expect(n).toBe(2);
    expect(out.slice(0, 2).sort()).toEqual([0, 1]);
  });

  it("forgets the old frames when loaded again", () => {
    const index = new GridIndex();
    index.load(grid(4, 4));
    index.load([{ x: 0, y: 0, w: 10, h: 10 }]);
    expect(query(index, { x: -100, y: -100, w: 50000, h: 50000 })).toEqual([0]);
  });
});

describe("GridIndex.hit", () => {
  it("finds the frame under a point and nothing in a gap", () => {
    const rects = grid(10, 10);
    const index = new GridIndex();
    index.load(rects);
    expect(index.hit(473 * 3 + 10, 992 * 2 + 10)).toBe(23);
    expect(index.hit(473 * 3 + 400, 992 * 2 + 10)).toBe(-1);
    expect(index.hit(-50, -50)).toBe(-1);
  });

  it("returns the topmost of overlapping frames, which is the later one", () => {
    const index = new GridIndex();
    index.load([
      { x: 0, y: 0, w: 200, h: 200 },
      { x: 100, y: 100, w: 200, h: 200 },
    ]);
    expect(index.hit(150, 150)).toBe(1);
    expect(index.hit(50, 50)).toBe(0);
  });
});
