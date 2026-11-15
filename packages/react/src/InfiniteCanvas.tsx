import * as React from "react";
import { createContext, memo, startTransition, useContext, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { connectCanvas, createCanvas, type CanvasConnection, type CanvasEngine, type EngineOptions, type FrameSpec, type MountedFrame, type Structure } from "open-infinite-canvas";

/** Props for {@link InfiniteCanvas}. */
export type InfiniteCanvasProps = {
  /** Every screen on the canvas. Keep the array's identity stable between renders, or every screen starts again. */
  frames: readonly FrameSpec[];
  /**
   * Draws one screen. Only called for frames the engine has decided to mount. Not called for a frame with
   * `src`, which is rendered as an iframe. Keep the function's identity stable.
   */
  renderFrame: (frame: FrameSpec) => ReactNode;
  /** The accessible name of the whole canvas. */
  label: string;
  /** Engine options, read once when the canvas mounts. Defaults are 24 live screens and 24 parked. */
  options?: EngineOptions;
  /** Called once the engine is mounted and has its frames. */
  onReady?: (engine: CanvasEngine) => void;
  /** Called when the selected frame changes, by pointer or by keyboard. */
  onSelect?: (id: string | null) => void;
  /** Added to the viewport element. */
  className?: string;
  /** Added to the viewport element. */
  style?: CSSProperties;
  /**
   * Floats over the canvas in screen pixels and is not moved by pan or zoom. Mark interactive parts with
   * `data-ic-chrome` so the canvas leaves their pointer events alone.
   */
  children?: ReactNode;
};

/** What {@link useFrame} returns. */
export type FrameContext = {
  frame: FrameSpec;
  /** `live` when the screen is visible and interactive, `parked` when hidden, `staging` while its picture is taken. */
  mode: MountedFrame["mode"];
};

const EngineContext = createContext<CanvasEngine | null>(null);
const FrameCtx = createContext<FrameContext | null>(null);

/** The engine of the nearest {@link InfiniteCanvas}. For overlays and screens that move the camera. */
export function useInfiniteCanvas(): CanvasEngine {
  const engine = useContext(EngineContext);
  if (!engine) throw new Error("useInfiniteCanvas must be called inside <InfiniteCanvas>.");
  return engine;
}

/** Inside a screen: its frame and whether it is live, parked or staging. Null outside a screen. */
export function useFrame(): FrameContext | null {
  return useContext(FrameCtx);
}

type ActivityProps = { mode: "visible" | "hidden"; children?: ReactNode };

/* Read by a computed key, so a bundler does not report a missing export on React 18. */
const ACTIVITY_KEY = "Activity";
const NativeActivity = (React as unknown as Record<string, unknown>)[ACTIVITY_KEY] as React.ComponentType<ActivityProps> | undefined;

/**
 * True when this React has `Activity` (19.2 and later). A parked screen then keeps its state and has its
 * effects turned off. Without it a parked screen keeps its state, is hidden with CSS, and its effects go on running.
 */
export const hasActivity: boolean = typeof NativeActivity !== "undefined";

const Activity: React.ComponentType<ActivityProps> = NativeActivity ?? (({ children }: ActivityProps) => <>{children}</>);

/**
 * The React binding. It renders what the engine asks for and nothing more.
 *
 * Camera moves never pass through React. The only renders are when a frame changes tier, and those are marked
 * as transitions so React can spread the work over several frames.
 *
 * Import `open-infinite-canvas/styles.css` once, and give the canvas's parent a size.
 *
 * @example
 * <InfiniteCanvas label="Checkout redesign" frames={frames} renderFrame={(frame) => <Screen id={frame.id} />} />
 */
export function InfiniteCanvas({ frames, renderFrame, options, label, onReady, onSelect, className, style, children }: InfiniteCanvasProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const far = useRef<HTMLCanvasElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const status = useRef<HTMLDivElement>(null);
  const connection = useRef<CanvasConnection | null>(null);
  const [engine, setEngine] = useState<CanvasEngine | null>(null);
  const [structure, setStructure] = useState<Structure | null>(null);
  const byId = useMemo(() => new Map(frames.map((f) => [f.id, f])), [frames]);
  const callbacks = useRef({ onReady, onSelect });
  callbacks.current = { onReady, onSelect };
  const first = useRef({ options, label, frames });
  first.current.frames = frames;

  /* The engine lives exactly as long as the mounted DOM does, which also keeps it right under Strict Mode. */
  useLayoutEffect(() => {
    const made = createCanvas(first.current.options);
    made.mount(viewport.current!, world.current!, far.current!);
    const connected = connectCanvas(made, { viewport: viewport.current!, world: world.current!, list: list.current!, status: status.current! }, { label: first.current.label, onSelect: (id) => callbacks.current.onSelect?.(id) });
    const unsubscribe = made.subscribe(() => startTransition(() => setStructure(made.getStructure())));
    made.setFrames(first.current.frames);
    connected.setFrames(first.current.frames);
    made.fit(undefined, { animate: false });
    connection.current = connected;
    setEngine(made);
    setStructure(made.getStructure());
    callbacks.current.onReady?.(made);
    return () => {
      unsubscribe();
      connected.destroy();
      made.destroy();
      connection.current = null;
      setEngine(null);
      setStructure(null);
    };
  }, []);

  const loaded = useRef<readonly FrameSpec[] | null>(null);
  useLayoutEffect(() => {
    if (!engine) return;
    /* The first set was loaded when the engine was made. */
    if (loaded.current === null || loaded.current === frames) {
      loaded.current = frames;
      return;
    }
    loaded.current = frames;
    engine.setFrames(frames);
    connection.current?.setFrames(frames);
    engine.fit(undefined, { animate: false });
    callbacks.current.onReady?.(engine);
  }, [engine, frames]);

  return (
    <div ref={viewport} className={className ? `ic-viewport ${className}` : "ic-viewport"} style={style} tabIndex={0} role="group" aria-roledescription="canvas" aria-label={label}>
      <canvas ref={far} className="ic-far" aria-hidden="true" />
      {/* Every screen, mounted or not, as a list a keyboard and a screen reader can walk. The engine fills it in.
          It comes before the screens, so Tab reaches it first and the controls of live screens after it. */}
      <ol ref={list} className="ic-list" />
      <div ref={world} className="ic-world">
        {engine && structure
          ? structure.mounted.map((m) => {
              const frame = byId.get(m.id);
              return frame ? <FrameHost key={m.id} frame={frame} mode={m.mode} engine={engine} render={renderFrame} /> : null;
            })
          : null}
      </div>
      <div ref={status} className="ic-sr" role="status" aria-live="polite" />
      {engine ? <EngineContext.Provider value={engine}>{children}</EngineContext.Provider> : null}
    </div>
  );
}

const FrameHost = memo(function FrameHost({ frame, mode, engine, render }: { frame: FrameSpec; mode: MountedFrame["mode"]; engine: CanvasEngine; render: (frame: FrameSpec) => ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    engine.attach(frame.id, host.current);
    return () => engine.attach(frame.id, null);
  }, [engine, frame.id]);
  useLayoutEffect(() => {
    /* Set as a property, because React 18 does not know the `inert` attribute. */
    if (host.current) host.current.inert = mode !== "live";
    if (mode === "live") engine.shown(frame.id);
  }, [mode, engine, frame.id]);
  const content = useMemo(() => (frame.src ? <iframe className="ic-iframe" src={frame.src} title={frame.name} /> : render(frame)), [render, frame]);
  const context = useMemo(() => ({ frame, mode }), [frame, mode]);
  return (
    <div ref={host} className="ic-frame" data-ic-frame={frame.id} data-mode={mode} style={{ width: frame.w, height: frame.h }}>
      <EngineContext.Provider value={engine}>
        <FrameCtx.Provider value={context}>
          {/* Hidden mode keeps the screen's state and DOM, and turns its effects off. */}
          <Activity mode={mode === "parked" ? "hidden" : "visible"}>{content}</Activity>
        </FrameCtx.Provider>
      </EngineContext.Provider>
    </div>
  );
});
