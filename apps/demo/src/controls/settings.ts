import { DEFAULT_INPUT, DEFAULT_LOD, autoProvider, htmlInCanvasProvider, screenshotProvider, svgProvider, type EngineReconfigure, type PictureProvider } from "open-infinite-canvas";
import type { DemoFrame, Device } from "../screens/registry";

/**
 * Every setting the control panel can change. Grouped as the panel shows them.
 *
 * Each field maps to one real option: an engine option, a field of `lod` or `input`, or how the demo builds its
 * frames. Nothing here is decoration.
 */
export type Settings = {
  screens: {
    count: number;
    /** 0 is automatic. */
    columns: number;
    gap: number;
    device: Device | "mixed";
    /** How many screens run in iframe mode. */
    iframes: number;
  };
  camera: {
    minZoom: number;
    maxZoom: number;
    zoomSpeed: number;
    wheel: "pan" | "zoom";
    inertia: boolean;
    friction: number;
  };
  lod: {
    maxLive: number;
    maxParked: number;
    liveInScale: number;
    /** The gap between `liveInScale` and `liveOutScale`. */
    hysteresis: number;
    tinyScale: number;
    thumbScale: number;
    maxThumbs: number;
    maxPreviews: number;
    marginPx: number;
    settleMs: number;
    mountsStill: number;
    mountsMoving: number;
    lateFrameMs: number;
    evictionsPerFrame: number;
    stagingMax: number;
    stagingPerFrame: number;
    stagingGroup: number;
  };
  pictures: {
    provider: ProviderName;
    smoothing: "auto" | "high" | "low" | "off";
    previewScale: number;
    warmup: boolean;
    captureConcurrency: number;
    fileLoadsMax: number;
  };
  rendering: {
    farLayer: boolean;
    /** 0 is no cap. */
    maxPixelRatio: number;
    contentVisibility: boolean;
    motion: "system" | "reduce" | "full";
    willChange: "gesture" | "always" | "never";
    origin: "floating" | "fixed";
    farZoomSlack: number;
  };
  input: {
    panButton: "middle" | "right" | "none";
    spaceDrag: boolean;
    keyStep: number;
  };
  debug: {
    tiers: boolean;
    outlines: boolean;
    hitBoxes: boolean;
    cells: boolean;
    hud: boolean;
  };
};

export type ProviderName = "auto" | "html-in-canvas" | "svg" | "screenshot";
export type Group = keyof Settings;

export const DEFAULTS: Settings = {
  screens: { count: 300, columns: 0, gap: 80, device: "mixed", iframes: 4 },
  camera: { minZoom: 0.02, maxZoom: 64, zoomSpeed: DEFAULT_INPUT.zoomSpeed, wheel: DEFAULT_INPUT.wheel, inertia: DEFAULT_INPUT.inertia, friction: DEFAULT_INPUT.friction },
  lod: {
    maxLive: DEFAULT_LOD.maxLive,
    maxParked: DEFAULT_LOD.maxParked,
    liveInScale: DEFAULT_LOD.liveInScale,
    hysteresis: Math.round((DEFAULT_LOD.liveInScale - DEFAULT_LOD.liveOutScale) * 100) / 100,
    tinyScale: DEFAULT_LOD.tinyScale,
    thumbScale: DEFAULT_LOD.thumbScale,
    maxThumbs: DEFAULT_LOD.maxThumbs,
    maxPreviews: DEFAULT_LOD.maxPreviews,
    marginPx: DEFAULT_LOD.marginPx,
    settleMs: DEFAULT_LOD.settleMs,
    mountsStill: DEFAULT_LOD.mountsStill,
    mountsMoving: DEFAULT_LOD.mountsMoving,
    lateFrameMs: DEFAULT_LOD.lateFrameMs,
    evictionsPerFrame: DEFAULT_LOD.evictionsPerFrame,
    stagingMax: DEFAULT_LOD.stagingMax,
    stagingPerFrame: DEFAULT_LOD.stagingPerFrame,
    stagingGroup: DEFAULT_LOD.stagingGroup,
  },
  pictures: { provider: "auto", smoothing: "auto", previewScale: DEFAULT_LOD.previewScale, warmup: true, captureConcurrency: DEFAULT_LOD.captureConcurrency, fileLoadsMax: DEFAULT_LOD.fileLoadsMax },
  rendering: { farLayer: true, maxPixelRatio: 0, contentVisibility: true, motion: "system", willChange: "gesture", origin: "floating", farZoomSlack: 1.12 },
  input: { panButton: DEFAULT_INPUT.panButton, spaceDrag: DEFAULT_INPUT.spaceDrag, keyStep: DEFAULT_INPUT.keyStep },
  debug: { tiers: false, outlines: false, hitBoxes: false, cells: false, hud: false },
};

/** A preset changes only the engine groups. Screens and debug overlays stay as they are. */
export type PresetName = "default" | "quality" | "speed" | "memory";
type Patch = { [G in Group]?: Partial<Settings[G]> };

export const PRESETS: Record<PresetName, { label: string; note: string; patch: Patch }> = {
  default: {
    label: "Default",
    note: "The engine as it ships.",
    patch: { camera: DEFAULTS.camera, lod: DEFAULTS.lod, pictures: DEFAULTS.pictures, rendering: DEFAULTS.rendering, input: DEFAULTS.input },
  },
  quality: {
    label: "Max quality",
    note: "More live screens, sharper pictures, more of them kept. Costs memory and time.",
    patch: {
      lod: { maxLive: 48, maxParked: 48, liveInScale: 0.3, hysteresis: 0.1, tinyScale: 0.25, thumbScale: 0.5, maxThumbs: 2000, maxPreviews: 256, mountsStill: 4, mountsMoving: 2 },
      pictures: { previewScale: 1, smoothing: "high", warmup: true },
      rendering: { maxPixelRatio: 0, farLayer: true },
    },
  },
  speed: {
    label: "Max speed",
    note: "Few live screens, small pictures, cheap smoothing and a pixel ratio of 1.",
    patch: {
      lod: { maxLive: 8, maxParked: 8, liveInScale: 0.6, hysteresis: 0.1, tinyScale: 0.0625, thumbScale: 0.125, maxPreviews: 32, mountsStill: 2, mountsMoving: 1, lateFrameMs: 16, stagingPerFrame: 2 },
      pictures: { previewScale: 0.25, smoothing: "low", captureConcurrency: 1 },
      rendering: { maxPixelRatio: 1, willChange: "gesture" },
    },
  },
  memory: {
    label: "Low memory",
    note: "Nothing parked, small caches, small pictures.",
    patch: {
      lod: { maxLive: 8, maxParked: 0, tinyScale: 0.0625, thumbScale: 0.125, maxThumbs: 100, maxPreviews: 16, stagingMax: 4, stagingGroup: 4 },
      pictures: { previewScale: 0.25 },
      rendering: { maxPixelRatio: 1 },
    },
  },
};

export function applyPatch(base: Settings, patch: Patch): Settings {
  const out = structuredClone(base);
  for (const g of Object.keys(patch) as Group[]) Object.assign(out[g], patch[g]);
  return out;
}

/** The settings as engine options. The provider is left out, because a new one drops every picture. */
export function toEngine(s: Settings): EngineReconfigure {
  return {
    minZoom: s.camera.minZoom,
    maxZoom: s.camera.maxZoom,
    lod: {
      maxLive: s.lod.maxLive,
      maxParked: s.lod.maxParked,
      liveInScale: s.lod.liveInScale,
      liveOutScale: Math.max(0, Math.round((s.lod.liveInScale - s.lod.hysteresis) * 1e4) / 1e4),
      tinyScale: s.lod.tinyScale,
      thumbScale: s.lod.thumbScale,
      previewScale: s.pictures.previewScale,
      maxThumbs: s.lod.maxThumbs,
      maxPreviews: s.lod.maxPreviews,
      marginPx: s.lod.marginPx,
      settleMs: s.lod.settleMs,
      mountsStill: s.lod.mountsStill,
      mountsMoving: s.lod.mountsMoving,
      lateFrameMs: s.lod.lateFrameMs,
      evictionsPerFrame: s.lod.evictionsPerFrame,
      stagingMax: s.lod.stagingMax,
      stagingPerFrame: s.lod.stagingPerFrame,
      stagingGroup: s.lod.stagingGroup,
      captureConcurrency: s.pictures.captureConcurrency,
      fileLoadsMax: s.pictures.fileLoadsMax,
    },
    input: { wheel: s.camera.wheel, zoomSpeed: s.camera.zoomSpeed, inertia: s.camera.inertia, friction: s.camera.friction, panButton: s.input.panButton, spaceDrag: s.input.spaceDrag, keyStep: s.input.keyStep },
    warmup: s.pictures.warmup,
    pictureSmoothing: s.pictures.smoothing,
    farLayer: s.rendering.farLayer,
    maxPixelRatio: s.rendering.maxPixelRatio,
    contentVisibility: s.rendering.contentVisibility,
    reducedMotion: s.rendering.motion === "system" ? null : s.rendering.motion === "reduce",
    willChange: s.rendering.willChange,
    origin: s.rendering.origin,
    farZoomSlack: s.rendering.farZoomSlack,
  };
}

/**
 * The address of a screenshot made ahead of time by `pnpm demo:shots`. One file for each screen template, device
 * and theme. A missing file leaves the frame as a placeholder and is counted as a picture error.
 */
export function shotUrl(frame: DemoFrame): string {
  const theme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  return `${import.meta.env.BASE_URL}shots/${frame.variant}-${frame.device}-${theme}.png`;
}

export function makeProvider(name: ProviderName): PictureProvider {
  switch (name) {
    case "html-in-canvas":
      return htmlInCanvasProvider();
    case "svg":
      return svgProvider();
    case "screenshot":
      return screenshotProvider({ url: (f) => shotUrl(f as DemoFrame) });
    default:
      return autoProvider();
  }
}

/* ------------------------------------------------------------ saving */

const STORAGE_KEY = "open-infinite-canvas-demo:settings";
const HASH_KEY = "settings";

/** Only what differs from the defaults, so a link stays short. */
export function diff(s: Settings): Patch {
  const out: Patch = {};
  for (const g of Object.keys(DEFAULTS) as Group[]) {
    const changed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s[g])) if ((DEFAULTS[g] as Record<string, unknown>)[k] !== v) changed[k] = v;
    if (Object.keys(changed).length) (out as Record<string, unknown>)[g] = changed;
  }
  return out;
}

/** Reads a saved patch, keeping only known keys with a value of the right type. */
export function sanitise(raw: unknown): Patch {
  const out: Patch = {};
  if (!raw || typeof raw !== "object") return out;
  for (const g of Object.keys(DEFAULTS) as Group[]) {
    const src = (raw as Record<string, unknown>)[g];
    if (!src || typeof src !== "object") continue;
    const clean: Record<string, unknown> = {};
    for (const [k, def] of Object.entries(DEFAULTS[g])) {
      const v = (src as Record<string, unknown>)[k];
      if (typeof v === typeof def && (typeof v !== "number" || Number.isFinite(v))) clean[k] = v;
    }
    (out as Record<string, unknown>)[g] = clean;
  }
  return out;
}

export function encodeHash(s: Settings): string {
  const d = diff(s);
  return Object.keys(d).length ? `#${HASH_KEY}=${encodeURIComponent(JSON.stringify(d))}` : "";
}

function fromHash(): Patch | null {
  const m = window.location.hash.match(new RegExp(`${HASH_KEY}=([^&]*)`));
  if (!m) return null;
  try {
    return sanitise(JSON.parse(decodeURIComponent(m[1])));
  } catch {
    return null;
  }
}

function fromStorage(): Patch | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitise(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** The address bar wins over what this browser saved. The older query parameters still work on top. */
export function loadSettings(): Settings {
  let s = applyPatch(DEFAULTS, fromHash() ?? fromStorage() ?? {});
  const q = new URLSearchParams(window.location.search);
  const num = (key: string) => (q.has(key) && Number.isFinite(Number(q.get(key))) ? Number(q.get(key)) : undefined);
  const n = num("n");
  const iframes = num("isolated");
  const maxLive = num("maxLive");
  const maxParked = num("maxParked");
  if (n !== undefined) s = applyPatch(s, { screens: { count: Math.min(2000, Math.max(50, n)) } });
  if (iframes !== undefined) s = applyPatch(s, { screens: { iframes: Math.max(0, iframes) } });
  if (maxLive !== undefined) s = applyPatch(s, { lod: { maxLive } });
  if (maxParked !== undefined) s = applyPatch(s, { lod: { maxParked } });
  if (q.get("motion") === "reduce") s = applyPatch(s, { rendering: { motion: "reduce" } });
  return s;
}

export function saveSettings(s: Settings) {
  try {
    const d = diff(s);
    if (Object.keys(d).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Private windows can refuse storage. The address bar still holds the settings. */
  }
  const url = `${window.location.pathname}${window.location.search}${encodeHash(s)}`;
  window.history.replaceState(null, "", url);
}

export function clearSaved() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* See above. */
  }
}
