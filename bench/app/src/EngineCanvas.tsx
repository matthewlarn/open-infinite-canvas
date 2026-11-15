import { useCallback, useEffect, useRef } from "react";
import type { CanvasEngine, EngineOptions } from "open-infinite-canvas";
import { InfiniteCanvas } from "@open-infinite-canvas/react";
import { renderDemoFrame, type DemoFrame } from "open-infinite-canvas-demo/screens";
import { publishBench } from "./bench-hooks";

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return { canvas: v("--ic-canvas"), surface: v("--surface"), border: v("--ic-border"), label: v("--ic-label"), accent: v("--ic-accent"), skeleton: v("--ic-skeleton") };
}

/** The engine under test, built from the packaged `open-infinite-canvas` and `@open-infinite-canvas/react`. */
export function EngineCanvas({ frames, options, theme }: { frames: DemoFrame[]; options: EngineOptions; theme: string }) {
  const engineRef = useRef<CanvasEngine | null>(null);

  const onReady = useCallback(
    (engine: CanvasEngine) => {
      engineRef.current = engine;
      engine.setColors(readColors());
      publishBench({
        variant: "engine",
        frames,
        viewport: () => engine.getViewport(),
        setCamera: (c) => engine.setCamera(c),
        getCamera: () => engine.getCamera(),
        stats: () => engine.stats() as unknown as Record<string, unknown>,
        idle: () => {
          const s = engine.stats();
          return !s.busy && (!options.warmup || s.warm);
        },
        resetStats: () => engine.resetTickStats(),
      });
      (window as unknown as { __engine: CanvasEngine }).__engine = engine;
    },
    [frames, options.warmup],
  );

  /* A picture bakes in its colours, so a theme change makes every picture stale. */
  const firstTheme = useRef(theme);
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setColors(readColors());
    if (firstTheme.current !== theme) {
      firstTheme.current = theme;
      engine.invalidatePictures();
    }
  }, [theme]);

  return <InfiniteCanvas frames={frames} renderFrame={renderDemoFrame} options={options} label="Harbor Street Tool Library, every screen" onReady={onReady} />;
}
