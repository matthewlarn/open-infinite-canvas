import { describe, expect, it } from "vitest";
import { LodScheduler, mountBudget, pickLive, type LodFrame, type LodInput } from "../src/lod";
import { DEFAULT_LOD, type Camera, type Tier } from "../src/types";

const VW = 1440;
const VH = 900;

/** A row of phone sized frames, 473 world pixels apart. */
function row(count: number): LodFrame[] {
  return Array.from({ length: count }, (_, i) => ({ x: i * 473, y: 0, w: 393, h: 852, tier: "picture" as Tier, prio: 0, lastLiveAt: 0 }));
}

/** A camera at zoom `z` centred on frame `i` of a row. */
function centredOn(i: number, z: number): Camera {
  return { z, x: VW / 2 - (i * 473 + 196.5) * z, y: VH / 2 - 426 * z };
}

function input(frames: LodFrame[], cam: Camera, more: Partial<LodInput> = {}): LodInput {
  const visible = frames.map((_, i) => i);
  return { cam, vw: VW, vh: VH, visible, visibleCount: visible.length, selected: -1, moving: false, lastFrameMs: 16.7, now: 0, ...more };
}

/** Runs the scheduler until it reports nothing left to do. Returns how many passes that took. */
function settle(lod: LodScheduler, make: () => LodInput, limit = 500): number {
  for (let n = 1; n <= limit; n++) if (!lod.update(make()).pending) return n;
  throw new Error("The scheduler never settled.");
}

const tiers = (frames: LodFrame[]) => frames.map((f) => f.tier);

describe("mountBudget", () => {
  it("allows two mounts a frame when the camera is still", () => {
    expect(mountBudget(false, 16.7)).toBe(2);
    expect(mountBudget(false, 80)).toBe(2);
  });
  it("allows one mount a frame while moving", () => {
    expect(mountBudget(true, 16.7)).toBe(1);
  });
  it("allows none while moving if the last frame was late", () => {
    expect(mountBudget(true, 24.1)).toBe(0);
    expect(mountBudget(true, 24)).toBe(1);
  });
});

describe("pickLive", () => {
  it("picks nothing below the live-out scale", () => {
    const frames = row(10);
    expect(pickLive(frames, input(frames, centredOn(5, 0.34)), DEFAULT_LOD)).toEqual([]);
  });

  it("picks nothing new between the two thresholds, but keeps what is live", () => {
    const frames = row(10);
    frames[5].tier = "live";
    expect(pickLive(frames, input(frames, centredOn(5, 0.4)), DEFAULT_LOD)).toEqual([5]);
  });

  it("orders by distance from the centre of the view", () => {
    const frames = row(9);
    const picked = pickLive(frames, input(frames, centredOn(4, 1)), DEFAULT_LOD);
    expect(picked[0]).toBe(4);
    expect(new Set(picked.slice(1, 3))).toEqual(new Set([3, 5]));
    expect(new Set(picked.slice(3, 5))).toEqual(new Set([2, 6]));
  });

  it("caps the list at maxLive", () => {
    const frames = row(60);
    expect(pickLive(frames, input(frames, centredOn(30, 0.5)), { ...DEFAULT_LOD, maxLive: 7 }).length).toBe(7);
  });

  it("puts the selected frame first however far it is", () => {
    const frames = row(60);
    const picked = pickLive(frames, input(frames, centredOn(10, 0.5), { selected: 55 }), { ...DEFAULT_LOD, maxLive: 5 });
    expect(picked[0]).toBe(55);
    expect(picked.length).toBe(5);
  });

  it("lets a live frame keep its place against one that is only a little nearer", () => {
    const frames = row(4);
    /* The view is centred between frames 1 and 2, a shade nearer to 2. Frame 1 is live already. */
    const cam = { z: 1, x: VW / 2 - (473 + 196.5 + 473 / 2 + 20), y: VH / 2 - 426 };
    frames[1].tier = "live";
    expect(pickLive(frames, input(frames, cam), { ...DEFAULT_LOD, maxLive: 1 })).toEqual([1]);
    frames[1].tier = "picture";
    expect(pickLive(frames, input(frames, cam), { ...DEFAULT_LOD, maxLive: 1 })).toEqual([2]);
  });

  it("only considers frames listed as visible", () => {
    const frames = row(10);
    const picked = pickLive(frames, { cam: centredOn(5, 1), vw: VW, vh: VH, visible: [4, 5, 6, 9, 9, 9], visibleCount: 3, selected: -1 }, DEFAULT_LOD);
    expect([...picked].sort()).toEqual([4, 5, 6]);
  });
});

describe("LodScheduler", () => {
  it("promotes two frames a pass when still and reports that more is pending", () => {
    const frames = row(6);
    const lod = new LodScheduler(DEFAULT_LOD, frames);
    const first = lod.update(input(frames, centredOn(2, 1)));
    expect(first).toEqual({ changed: true, pending: true });
    expect(lod.live.size).toBe(2);
    expect(frames[2].tier).toBe("live");
    const passes = settle(lod, () => input(frames, centredOn(2, 1)));
    expect(passes).toBe(2);
    expect(lod.live.size).toBe(6);
    expect(lod.update(input(frames, centredOn(2, 1)))).toEqual({ changed: false, pending: false });
  });

  it("promotes one frame a pass while moving, and none after a late frame", () => {
    const frames = row(6);
    const lod = new LodScheduler(DEFAULT_LOD, frames);
    lod.update(input(frames, centredOn(2, 1), { moving: true }));
    expect(lod.live.size).toBe(1);
    const late = lod.update(input(frames, centredOn(2, 1), { moving: true, lastFrameMs: 40 }));
    expect(lod.live.size).toBe(1);
    expect(late).toEqual({ changed: false, pending: true });
    lod.update(input(frames, centredOn(2, 1), { moving: true }));
    expect(lod.live.size).toBe(2);
  });

  it("never has more live frames than maxLive", () => {
    const frames = row(200);
    const cfg = { ...DEFAULT_LOD, maxLive: 24 };
    const lod = new LodScheduler(cfg, frames);
    for (let step = 0; step < 150; step++) {
      lod.update(input(frames, centredOn(step, 0.5), { moving: step % 3 !== 0, now: step }));
      expect(lod.live.size).toBeLessThanOrEqual(24);
      expect(frames.filter((f) => f.tier === "live").length).toBe(lod.live.size);
    }
  });

  it("parks a live frame when the zoom drops below the live-out scale", () => {
    const frames = row(4);
    const lod = new LodScheduler(DEFAULT_LOD, frames);
    settle(lod, () => input(frames, centredOn(1, 1)));
    expect(tiers(frames)).toEqual(["live", "live", "live", "live"]);
    const out = lod.update(input(frames, centredOn(1, 0.1)));
    expect(out.changed).toBe(true);
    expect(tiers(frames)).toEqual(["parked", "parked", "parked", "parked"]);
    expect(lod.live.size).toBe(0);
    expect(lod.parked.length).toBe(4);
  });

  it("does not flicker inside the gap between the two thresholds", () => {
    const frames = row(3);
    const lod = new LodScheduler(DEFAULT_LOD, frames);
    /* Coming up from below: 0.40 is not enough to go live. */
    lod.update(input(frames, centredOn(1, 0.4)));
    expect(lod.live.size).toBe(0);
    settle(lod, () => input(frames, centredOn(1, 0.46)));
    expect(lod.live.size).toBe(3);
    /* Going back down: 0.40 is still enough to stay live. */
    for (const z of [0.44, 0.4, 0.36, 0.4, 0.44]) expect(lod.update(input(frames, centredOn(1, z))).changed).toBe(false);
    expect(lod.live.size).toBe(3);
    lod.update(input(frames, centredOn(1, 0.34)));
    expect(lod.live.size).toBe(0);
  });

  it("brings a parked frame back to live without going through eviction", () => {
    const frames = row(3);
    const evicted: number[] = [];
    const lod = new LodScheduler(DEFAULT_LOD, frames, { onEvict: (i) => (evicted.push(i), "picture") });
    settle(lod, () => input(frames, centredOn(1, 1)));
    lod.update(input(frames, centredOn(1, 0.1)));
    settle(lod, () => input(frames, centredOn(1, 1)));
    expect(tiers(frames)).toEqual(["live", "live", "live"]);
    expect(lod.parked).toEqual([]);
    expect(evicted).toEqual([]);
  });

  it("evicts the oldest parked frames first, two a pass, down to maxParked", () => {
    const frames = row(10);
    const cfg = { ...DEFAULT_LOD, maxLive: 10, maxParked: 3 };
    const evicted: number[] = [];
    const lod = new LodScheduler(cfg, frames, { onEvict: (i) => (evicted.push(i), "picture") });
    settle(lod, () => input(frames, centredOn(4, 0.5)));
    expect(lod.live.size).toBe(10);
    /* Zoom out. All ten are parked in one pass, in the order they went live, and two are evicted at once. */
    const parkedOrder = [...lod.live];
    const out = lod.update(input(frames, centredOn(4, 0.1)));
    expect(out.pending).toBe(true);
    expect(evicted).toEqual(parkedOrder.slice(0, 2));
    settle(lod, () => input(frames, centredOn(4, 0.1)));
    expect(lod.parked.length).toBe(3);
    expect(evicted).toEqual(parkedOrder.slice(0, 7));
    expect(lod.parked).toEqual(parkedOrder.slice(7));
    expect(frames.filter((f) => f.tier === "picture").length).toBe(7);
    expect(lod.counters).toEqual({ promotions: 10, demotions: 10, evictions: 7 });
  });

  it("falls back to placeholder on eviction when no hook says otherwise", () => {
    const frames = row(2);
    const lod = new LodScheduler({ ...DEFAULT_LOD, maxParked: 0 }, frames);
    settle(lod, () => input(frames, centredOn(0, 1)));
    settle(lod, () => input(frames, centredOn(0, 0.1)));
    expect(tiers(frames)).toEqual(["placeholder", "placeholder"]);
  });

  it("holds both budgets over a long walk across a large world", () => {
    const frames = row(1000);
    const lod = new LodScheduler(DEFAULT_LOD, frames, { onEvict: () => "picture" });
    let maxLive = 0;
    for (let step = 0; step < 900; step++) {
      /* Zoom in and out while moving along the row. */
      const z = step % 40 < 30 ? 0.6 : 0.2;
      lod.update(input(frames, centredOn(step, z), { moving: true, now: step }));
      maxLive = Math.max(maxLive, lod.live.size);
      expect(lod.parked.length).toBeLessThanOrEqual(DEFAULT_LOD.maxParked + frames.length);
    }
    settle(lod, () => input(frames, centredOn(900, 0.2)));
    expect(maxLive).toBeLessThanOrEqual(DEFAULT_LOD.maxLive);
    expect(lod.parked.length).toBeLessThanOrEqual(DEFAULT_LOD.maxParked);
    expect(frames.filter((f) => f.tier === "live" || f.tier === "parked").length).toBe(lod.live.size + lod.parked.length);
  });

  it("gives the selected frame a live slot ahead of nearer frames", () => {
    const frames = row(30);
    const lod = new LodScheduler({ ...DEFAULT_LOD, maxLive: 2 }, frames);
    lod.update(input(frames, centredOn(5, 0.5), { selected: 20, moving: true }));
    expect(frames[20].tier).toBe("live");
  });

  it("tells the owner about each change through the hooks", () => {
    const frames = row(2);
    frames[0].tier = "staging";
    const log: string[] = [];
    const lod = new LodScheduler({ ...DEFAULT_LOD, maxParked: 0 }, frames, {
      onPromote: (i, from) => log.push(`promote ${i} from ${from}`),
      onDemote: (i) => log.push(`demote ${i}`),
      onEvict: (i) => (log.push(`evict ${i}`), "picture"),
    });
    lod.update(input(frames, centredOn(0, 1), { now: 123 }));
    expect(frames[0].lastLiveAt).toBe(123);
    lod.update(input(frames, centredOn(0, 0.1)));
    expect(log).toEqual(["promote 0 from staging", "promote 1 from picture", "demote 0", "demote 1", "evict 0", "evict 1"]);
  });

  it("forgets everything on reset", () => {
    const frames = row(3);
    const lod = new LodScheduler(DEFAULT_LOD, frames);
    settle(lod, () => input(frames, centredOn(1, 1)));
    lod.reset();
    expect(lod.live.size).toBe(0);
    expect(lod.parked.length).toBe(0);
  });

  it("uses the documented defaults of 24 live and 24 parked", () => {
    expect(DEFAULT_LOD.maxLive).toBe(24);
    expect(DEFAULT_LOD.maxParked).toBe(24);
    expect(DEFAULT_LOD.liveOutScale).toBeLessThan(DEFAULT_LOD.liveInScale);
  });
});
