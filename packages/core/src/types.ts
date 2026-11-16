/** A rectangle in world pixels. */
export type Rect = { x: number; y: number; w: number; h: number };

/** The view. A world point maps to the screen as `screen = world * z + (x, y)`. */
export type Camera = { x: number; y: number; z: number };

/** One screen on the canvas. The rectangle is in world pixels and is never read back from the DOM. */
export type FrameSpec = {
  /** Unique among the frames of one canvas. */
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Drawn above the frame and read to screen readers. */
  name: string;
  /** Row or section the frame belongs to. */
  group?: string;
  /**
   * Optional iframe mode. When set, the view layer loads this URL in an iframe instead of rendering the screen
   * in the page's own document. Use it for a screen that must be isolated from the page.
   */
  src?: string;
  /**
   * Optional build-time screenshot of the screen. When set, the engine loads this image as the frame's picture
   * and never has to mount the screen just to draw it zoomed out.
   */
  picture?: string;
};

/**
 * How alive a frame is.
 *
 * The four tiers a consumer sees:
 *
 * - `live`: mounted, visible, interactive.
 * - `parked`: mounted but hidden. State is kept. With React 19.2 or later, effects are off too.
 * - `picture`: not mounted. A bitmap is drawn on the far canvas.
 * - `placeholder`: not mounted and no bitmap yet. A flat box is drawn.
 *
 * `staging` is internal: mounted for a moment so a picture can be taken, never laid out in the page or painted.
 */
export type Tier = "live" | "parked" | "staging" | "picture" | "placeholder";

/** The level of detail budgets and thresholds. Every field has a default in {@link DEFAULT_LOD}. */
export type LodConfig = {
  /** A frame may become live once its on-screen scale reaches this. */
  liveInScale: number;
  /** A live frame is demoted once its on-screen scale drops below this. The gap to `liveInScale` stops flicker. */
  liveOutScale: number;
  /** Most frames that may be live at once. */
  maxLive: number;
  /** Most frames kept mounted but hidden. The oldest are unmounted first. */
  maxParked: number;
  /** How far outside the viewport, in screen pixels, a frame still counts as near. */
  marginPx: number;
  /** Scale of the smallest picture. Every frame keeps one, so the whole world can always be drawn. */
  tinyScale: number;
  /** Scale of the middle picture, for a zoomed-out view of part of the world. */
  thumbScale: number;
  /** Scale of the sharpest picture, kept for frames near the live threshold. */
  previewScale: number;
  /** Most middle pictures kept. The ones farthest from the view are dropped first. */
  maxThumbs: number;
  /** Most sharp pictures kept. The ones farthest from the view are dropped first. */
  maxPreviews: number;
  /** Milliseconds without a camera change before the view counts as settled. */
  settleMs: number;
  /** Most screens mounted in one animation frame while the camera is still. */
  mountsStill: number;
  /** Most screens mounted in one animation frame while the camera moves. */
  mountsMoving: number;
  /** While the camera moves, nothing is mounted after an animation frame that took longer than this, in milliseconds. */
  lateFrameMs: number;
  /** Most parked screens unmounted in one animation frame. */
  evictionsPerFrame: number;
  /** Most frames mounted at once only to have their picture taken. */
  stagingMax: number;
  /** Most frames newly mounted for a picture in one animation frame. */
  stagingPerFrame: number;
  /** Pictures of staging frames are taken together once this many are mounted. */
  stagingGroup: number;
  /** Most pictures being made at once. */
  captureConcurrency: number;
  /** Most pictures being loaded from files at once. */
  fileLoadsMax: number;
};

/** The defaults: 24 live screens, 24 parked, 400 middle pictures, 64 sharp pictures. */
export const DEFAULT_LOD: LodConfig = {
  liveInScale: 0.45,
  liveOutScale: 0.35,
  maxLive: 24,
  maxParked: 24,
  marginPx: 240,
  tinyScale: 0.125,
  thumbScale: 0.25,
  previewScale: 0.5,
  maxThumbs: 400,
  maxPreviews: 64,
  settleMs: 140,
  mountsStill: 2,
  mountsMoving: 1,
  lateFrameMs: 24,
  evictionsPerFrame: 2,
  stagingMax: 8,
  stagingPerFrame: 4,
  stagingGroup: 4,
  captureConcurrency: 2,
  fileLoadsMax: 6,
};

/** How pointer, wheel and keys move the camera. Every field has a default in {@link DEFAULT_INPUT}. */
export type InputConfig = {
  /**
   * What a plain scroll does. `pan` suits a trackpad, where two fingers pan and a pinch zooms. `zoom` suits a
   * mouse wheel. A pinch, or a scroll with Ctrl or Cmd held, always zooms.
   */
  wheel: "pan" | "zoom";
  /** How fast a scroll or a pinch zooms. The zoom is multiplied by `exp(-delta * zoomSpeed)` for each scroll step. */
  zoomSpeed: number;
  /** True to glide on after a drag is released. Off for anyone who asked for reduced motion, whatever this says. */
  inertia: boolean;
  /** The share of a glide's speed lost in each 60 Hz frame. Higher stops sooner. */
  friction: number;
  /** The mouse button that pans from anywhere, over live screens too. `none` leaves only a drag on empty canvas. */
  panButton: "middle" | "right" | "none";
  /** True to pan by holding Space and dragging, over live screens too. */
  spaceDrag: boolean;
  /** Screen pixels an arrow key pans. Shift pans four times as far. */
  keyStep: number;
};

/** The defaults: scroll pans, a short glide, the middle button and Space pan from anywhere, arrow keys pan 64 pixels. */
export const DEFAULT_INPUT: InputConfig = {
  wheel: "pan",
  zoomSpeed: 0.01,
  inertia: true,
  friction: 0.06,
  panButton: "middle",
  spaceDrag: true,
  keyStep: 64,
};
