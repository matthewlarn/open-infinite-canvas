import type { Camera, LodConfig, Rect, Tier } from "./types.js";

/** What the scheduler needs to know about a frame. It mutates `tier`, `prio` and `lastLiveAt` in place. */
export type LodFrame = Rect & {
  tier: Tier;
  /** Scratch value used for sorting. */
  prio: number;
  /** When the frame last became live. */
  lastLiveAt: number;
};

/** One frame's worth of facts for the scheduler. */
export type LodInput = {
  cam: Camera;
  /** Viewport size in CSS pixels. */
  vw: number;
  vh: number;
  /** Indexes of the frames near the view, and how many of them are valid. */
  visible: ArrayLike<number>;
  visibleCount: number;
  /** Index of the selected frame, or -1. The selected frame always wins a live slot. */
  selected: number;
  /** True while the camera is moving. */
  moving: boolean;
  /** How long the previous animation frame took, in milliseconds. */
  lastFrameMs: number;
  /** A timestamp, in any unit that only grows. */
  now: number;
};

/** Side effects the owner of the scheduler wants to run when a frame changes tier. */
export type LodHooks = {
  /** A frame became live. `from` is the tier it left. */
  onPromote?(index: number, from: Tier): void;
  /** A live frame was parked. */
  onDemote?(index: number): void;
  /** A parked frame is being unmounted. Return the tier it falls to. The default is `placeholder`. */
  onEvict?(index: number): Tier;
};

export type LodResult = {
  /** True if any frame changed tier, so the view layer must render. */
  changed: boolean;
  /** True if work was left over for the next animation frame. */
  pending: boolean;
};

/**
 * How many screens may be mounted in this animation frame.
 *
 * Mounting a screen is the one expensive step. One per frame while the camera moves, none after a late frame,
 * two per frame when the camera is still.
 */
export function mountBudget(moving: boolean, lastFrameMs: number): number {
  if (!moving) return 2;
  return lastFrameMs > 24 ? 0 : 1;
}

/**
 * The frames that should be live, nearest the centre of the view first, written into `out`.
 *
 * A frame qualifies when the zoom is at or above `liveInScale`, or at or above `liveOutScale` if it is live
 * already. The gap between the two stops a frame flickering between tiers. A live frame keeps its place unless
 * another is clearly nearer, and the selected frame always comes first. At most `maxLive` are returned.
 */
export function pickLive<F extends LodFrame>(frames: readonly F[], input: Pick<LodInput, "cam" | "vw" | "vh" | "visible" | "visibleCount" | "selected">, cfg: Pick<LodConfig, "liveInScale" | "liveOutScale" | "maxLive">, out: number[] = []): number[] {
  const { cam, vw, vh, visible, visibleCount, selected } = input;
  const z = cam.z;
  out.length = 0;
  if (z < cfg.liveOutScale) return out;
  const cx = vw / 2;
  const cy = vh / 2;
  for (let n = 0; n < visibleCount; n++) {
    const i = visible[n];
    const f = frames[i];
    const isLive = f.tier === "live";
    if (z < (isLive ? cfg.liveOutScale : cfg.liveInScale)) continue;
    let d = Math.hypot((f.x + f.w / 2) * z + cam.x - cx, (f.y + f.h / 2) * z + cam.y - cy);
    if (isLive) d -= 200;
    if (i === selected) d = -1e9;
    f.prio = d;
    out.push(i);
  }
  out.sort((a, b) => frames[a].prio - frames[b].prio);
  if (out.length > cfg.maxLive) out.length = cfg.maxLive;
  return out;
}

/**
 * The level of detail scheduler. It decides which frames are live and which are parked, inside fixed budgets,
 * and moves only a few frames between tiers in any one animation frame.
 *
 * It has no DOM in it. The engine calls {@link LodScheduler.update} once per animation frame and renders
 * whatever changed.
 */
export class LodScheduler<F extends LodFrame = LodFrame> {
  /** Indexes of the live frames. */
  readonly live = new Set<number>();
  /** Indexes of the parked frames, oldest first. */
  readonly parked: number[] = [];
  /** Running totals since the scheduler was made. */
  readonly counters = { promotions: 0, demotions: 0, evictions: 0 };
  private want: number[] = [];
  private wantSet = new Set<number>();

  constructor(
    private cfg: Pick<LodConfig, "liveInScale" | "liveOutScale" | "maxLive" | "maxParked">,
    private frames: readonly F[],
    private hooks: LodHooks = {},
  ) {}

  /** Forgets every live and parked frame. Call it after the frame list is replaced. */
  reset(): void {
    this.live.clear();
    this.parked.length = 0;
  }

  /** One pass. Demotes live frames that are no longer wanted, promotes within the mount budget, evicts past the parked budget. */
  update(input: LodInput): LodResult {
    const { cfg, frames, want, wantSet } = this;
    pickLive(frames, input, cfg, want);
    wantSet.clear();
    for (const i of want) wantSet.add(i);

    let changed = false;
    for (const i of [...this.live]) {
      if (!wantSet.has(i)) {
        this.demote(i);
        changed = true;
      }
    }

    let budget = mountBudget(input.moving, input.lastFrameMs);
    let pending = false;
    for (const i of want) {
      if (frames[i].tier === "live") continue;
      if (budget <= 0) {
        pending = true;
        break;
      }
      this.promote(i, input.now);
      budget--;
      changed = true;
    }

    /* Hidden frames past the budget are unmounted, oldest first, two per frame. */
    let evict = 2;
    while (this.parked.length > cfg.maxParked && evict-- > 0) {
      this.evict(this.parked.shift()!);
      changed = true;
    }
    if (this.parked.length > cfg.maxParked) pending = true;
    return { changed, pending };
  }

  private promote(i: number, now: number) {
    const f = this.frames[i];
    const from = f.tier;
    if (from === "parked") this.parked.splice(this.parked.indexOf(i), 1);
    f.tier = "live";
    f.lastLiveAt = now;
    this.live.add(i);
    this.counters.promotions++;
    this.hooks.onPromote?.(i, from);
  }

  private demote(i: number) {
    const f = this.frames[i];
    this.live.delete(i);
    f.tier = "parked";
    this.parked.push(i);
    this.counters.demotions++;
    this.hooks.onDemote?.(i);
  }

  private evict(i: number) {
    this.frames[i].tier = this.hooks.onEvict?.(i) ?? "placeholder";
    this.counters.evictions++;
  }
}
