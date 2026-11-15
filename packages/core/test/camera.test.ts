import { describe, expect, it } from "vitest";
import { MAX_ZOOM, MIN_ZOOM, clamp, fitRect, intersects, lerpCamera, screenToWorld, unionRects, viewRect, worldToScreen, zoomAt } from "../src/camera";
import type { Camera } from "../src/types";

const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe("screenToWorld and worldToScreen", () => {
  it("are inverses of each other at any camera", () => {
    const cams: Camera[] = [
      { x: 0, y: 0, z: 1 },
      { x: -1234.5, y: 987.25, z: 0.06 },
      { x: 3e7, y: -3e7, z: 64 },
    ];
    for (const cam of cams) {
      const w = screenToWorld(cam, 517, 333);
      const s = worldToScreen(cam, w.x, w.y);
      close(s.x, 517, 1e-6);
      close(s.y, 333, 1e-6);
    }
  });

  it("follow screen = world * z + offset", () => {
    expect(worldToScreen({ x: 10, y: 20, z: 2 }, 100, 50)).toEqual({ x: 210, y: 120 });
    expect(screenToWorld({ x: 10, y: 20, z: 2 }, 210, 120)).toEqual({ x: 100, y: 50 });
  });
});

describe("zoomAt", () => {
  it("keeps the world point under the cursor where it is", () => {
    const cam: Camera = { x: -340, y: 125, z: 0.37 };
    const before = screenToWorld(cam, 517, 333);
    for (const z of [0.05, 0.37, 1, 2.5, 40]) {
      const next = zoomAt(cam, z, 517, 333);
      const after = screenToWorld(next, 517, 333);
      close(after.x, before.x, 1e-6);
      close(after.y, before.y, 1e-6);
      expect(next.z).toBe(z);
    }
  });

  it("stays put under many small steps, as a trackpad pinch sends them", () => {
    let cam: Camera = { x: 12, y: -40, z: 0.06 };
    const before = screenToWorld(cam, 900, 200);
    for (let i = 0; i < 400; i++) cam = zoomAt(cam, cam.z * Math.exp(0.02), 900, 200);
    const s = worldToScreen(cam, before.x, before.y);
    expect(Math.hypot(s.x - 900, s.y - 200)).toBeLessThan(0.01);
  });

  it("clamps to the zoom range and still keeps the cursor point", () => {
    const cam: Camera = { x: 0, y: 0, z: 1 };
    expect(zoomAt(cam, 1000, 10, 10).z).toBe(MAX_ZOOM);
    expect(zoomAt(cam, 0.000001, 10, 10).z).toBe(MIN_ZOOM);
    expect(zoomAt(cam, 9, 10, 10, 0.5, 4).z).toBe(4);
    const next = zoomAt(cam, 1000, 100, 50);
    const w = screenToWorld(next, 100, 50);
    close(w.x, 100, 1e-9);
    close(w.y, 50, 1e-9);
  });

  it("is the identity when the zoom does not change", () => {
    expect(zoomAt({ x: 5, y: 6, z: 2 }, 2, 300, 300)).toEqual({ x: 5, y: 6, z: 2 });
  });
});

describe("fitRect", () => {
  it("centres the rectangle and leaves the padding on the tight axis", () => {
    const cam = fitRect({ x: 1000, y: 2000, w: 800, h: 400 }, 1440, 900, 64);
    /* Width is the tight axis: (1440 - 128) / 800 = 1.64. */
    close(cam.z, 1.64);
    const tl = worldToScreen(cam, 1000, 2000);
    const br = worldToScreen(cam, 1800, 2400);
    close(tl.x, 64);
    close(br.x, 1440 - 64);
    close((tl.y + br.y) / 2, 450);
  });

  it("respects a zoom ceiling, for example fit everything but never past 100%", () => {
    const cam = fitRect({ x: 0, y: 0, w: 100, h: 100 }, 1440, 900, 64, 0.02, 1);
    expect(cam.z).toBe(1);
    expect(worldToScreen(cam, 50, 50)).toEqual({ x: 720, y: 450 });
  });

  it("respects a zoom floor for a huge world", () => {
    expect(fitRect({ x: 0, y: 0, w: 1e9, h: 1e9 }, 1440, 900).z).toBe(MIN_ZOOM);
  });
});

describe("viewRect", () => {
  it("is the part of the world the viewport shows", () => {
    expect(viewRect({ x: -200, y: -100, z: 2 }, 1440, 900)).toEqual({ x: 100, y: 50, w: 720, h: 450 });
  });

  it("grows by a margin given in screen pixels", () => {
    const r = viewRect({ x: 0, y: 0, z: 0.5 }, 1000, 500, 240);
    expect(r).toEqual({ x: -480, y: -480, w: 2960, h: 1960 });
  });
});

describe("lerpCamera", () => {
  const a: Camera = { x: 0, y: 0, z: 0.1 };
  const b: Camera = { x: -5000, y: -3000, z: 1 };

  it("starts at one camera and ends at the other", () => {
    const start = lerpCamera(a, b, 0, 1440, 900);
    const end = lerpCamera(a, b, 1, 1440, 900);
    close(start.x, a.x, 1e-6);
    close(start.z, a.z);
    close(end.x, b.x, 1e-6);
    close(end.y, b.y, 1e-6);
    close(end.z, b.z);
  });

  it("moves zoom in log space, so half way is the geometric mean", () => {
    close(lerpCamera(a, b, 0.5, 1440, 900).z, Math.sqrt(0.1 * 1));
  });

  it("moves the world point at the centre of the viewport in a straight line", () => {
    const ca = screenToWorld(a, 720, 450);
    const cb = screenToWorld(b, 720, 450);
    const mid = screenToWorld(lerpCamera(a, b, 0.25, 1440, 900), 720, 450);
    close(mid.x, ca.x + (cb.x - ca.x) * 0.25, 1e-6);
    close(mid.y, ca.y + (cb.y - ca.y) * 0.25, 1e-6);
  });
});

describe("rectangles", () => {
  it("unionRects covers every rectangle", () => {
    expect(
      unionRects([
        { x: 0, y: 0, w: 10, h: 10 },
        { x: -5, y: 20, w: 3, h: 3 },
        { x: 30, y: 5, w: 10, h: 2 },
      ]),
    ).toEqual({ x: -5, y: 0, w: 45, h: 23 });
  });

  it("unionRects of nothing is a unit rectangle, so a fit never divides by zero", () => {
    expect(unionRects([])).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it("intersects is true for overlap and false for touching edges", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(intersects(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(intersects(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
    expect(intersects(a, { x: 0, y: -5, w: 5, h: 5 })).toBe(false);
    expect(intersects(a, { x: 2, y: 2, w: 1, h: 1 })).toBe(true);
  });

  it("clamp holds a value inside its range", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
