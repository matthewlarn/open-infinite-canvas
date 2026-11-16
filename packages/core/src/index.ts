/**
 * open-infinite-canvas: an infinite canvas engine for hundreds of live screens.
 *
 * A few screens are awake as real DOM. The rest are pictures drawn on one canvas. The engine decides which is
 * which, inside fixed budgets, and keeps every frame reachable by keyboard and screen reader.
 *
 * @packageDocumentation
 */
export { CanvasEngine, createCanvas } from "./engine.js";
export type { EngineFrame, EngineOptions, EngineReconfigure, EngineSettings, EngineStats, MountedFrame, Structure } from "./engine.js";
export { DEFAULT_INPUT, DEFAULT_LOD } from "./types.js";
export type { Camera, FrameSpec, InputConfig, LodConfig, Rect, Tier } from "./types.js";

export { MAX_ZOOM, MIN_ZOOM, clamp, fitRect, intersects, lerpCamera, screenToWorld, unionRects, viewRect, worldToScreen, zoomAt } from "./camera.js";
export { GridIndex } from "./spatial.js";
export { LodScheduler, mountBudget, pickLive } from "./lod.js";
export type { LodFrame, LodHooks, LodInput, LodResult, MountBudgetConfig } from "./lod.js";
export { layoutRows, neighbourIndex, readingOrder } from "./layout.js";
export type { Direction, LayoutRowsOptions } from "./layout.js";

export { attachInput } from "./input.js";
export type { InputOptions } from "./input.js";
export { FOCUSABLE, connectCanvas, mountCanvas } from "./binding.js";
export type { CanvasConnection, CanvasParts, ConnectOptions, MountOptions, MountedCanvas } from "./binding.js";
export type { FarColors } from "./far-renderer.js";

export { autoProvider } from "./pictures/auto.js";
export { htmlInCanvasProvider, htmlInCanvasSupport } from "./pictures/html-in-canvas.js";
export { loadScreenshot, screenshotProvider } from "./pictures/screenshot.js";
export type { ScreenshotProviderOptions } from "./pictures/screenshot.js";
export { invalidateCss, pageCss, svgProvider } from "./pictures/svg.js";
export type { CaptureTimings, Picture, PictureProvider, PictureRequest, PictureResult } from "./pictures/types.js";
