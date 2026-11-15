import { describe, expect, it } from "vitest";
import { layoutRows, neighbourIndex, readingOrder } from "../src/layout";
import type { FrameSpec } from "../src/types";

const frame = (id: string, x: number, y: number, w = 393, h = 852): FrameSpec => ({ id, name: id, x, y, w, h });

describe("readingOrder", () => {
  it("goes row by row, left to right inside a row", () => {
    const frames = [frame("d", 473, 992), frame("b", 473, 0), frame("c", 0, 992), frame("a", 0, 0)];
    expect(readingOrder(frames)).toEqual(["a", "b", "c", "d"]);
  });

  it("treats frames that start a little lower as the same row", () => {
    const frames = [frame("a", 0, 0), frame("b", 473, 120), frame("c", 946, 40), frame("d", 0, 900)];
    expect(readingOrder(frames)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("neighbourIndex", () => {
  const rects = [frame("a", 0, 0), frame("b", 473, 0), frame("c", 946, 0), frame("d", 0, 992), frame("e", 473, 992)];

  it("moves to the nearest frame in each direction", () => {
    expect(neighbourIndex(rects, 0, "right")).toBe(1);
    expect(neighbourIndex(rects, 1, "left")).toBe(0);
    expect(neighbourIndex(rects, 1, "down")).toBe(4);
    expect(neighbourIndex(rects, 4, "up")).toBe(1);
  });

  it("returns -1 at an edge", () => {
    expect(neighbourIndex(rects, 0, "left")).toBe(-1);
    expect(neighbourIndex(rects, 0, "up")).toBe(-1);
    expect(neighbourIndex(rects, 2, "right")).toBe(-1);
    expect(neighbourIndex(rects, 9, "right")).toBe(-1);
  });

  it("prefers straight ahead over nearer but off to the side", () => {
    const set = [frame("from", 0, 0), frame("diagonal", 300, 500), frame("ahead", 900, 0)];
    expect(neighbourIndex(set, 0, "right")).toBe(2);
  });

  it("can reach every frame of a grid from any other", () => {
    const seen = new Set([0]);
    const queue = [0];
    while (queue.length) {
      const i = queue.shift()!;
      for (const dir of ["left", "right", "up", "down"] as const) {
        const n = neighbourIndex(rects, i, dir);
        if (n >= 0 && !seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    expect(seen.size).toBe(rects.length);
  });
});

describe("layoutRows", () => {
  const spec = (id: string, w = 393, h = 852, group?: string) => ({ id, name: id, w, h, group });

  it("places frames left to right with the gap between them and wraps at the row width", () => {
    const out = layoutRows([spec("a"), spec("b"), spec("c"), spec("d")], { gapX: 80, gapY: 140, maxRowWidth: 1000 });
    expect(out.map((f) => [f.x, f.y])).toEqual([
      [0, 0],
      [473, 0],
      [0, 992],
      [473, 992],
    ]);
  });

  it("starts a new row for a new group and uses the tallest frame for the row height", () => {
    const out = layoutRows([spec("a", 393, 852, "phone"), spec("b", 820, 1180, "phone"), spec("c", 1440, 900, "desktop")], { maxRowWidth: 10000 });
    expect(out[2]).toMatchObject({ x: 0, y: 1180 + 140 });
  });

  it("never overlaps two frames and keeps every input field", () => {
    const specs = Array.from({ length: 120 }, (_, i) => ({ ...spec(`f${i}`, i % 10 === 9 ? 1440 : 393, i % 10 === 9 ? 900 : 852), extra: i }));
    const out = layoutRows(specs);
    expect(out.length).toBe(120);
    expect(out[7].extra).toBe(7);
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        expect(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y).toBe(false);
      }
    }
  });

  it("does not change its input", () => {
    const specs = [spec("a"), spec("b")];
    const copy = JSON.stringify(specs);
    layoutRows(specs);
    expect(JSON.stringify(specs)).toBe(copy);
  });
});
