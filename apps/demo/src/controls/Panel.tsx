import { useId, useState, type ReactNode } from "react";
import { TIER_COLOURS, type BenchmarkResult, type LiveStats } from "./instruments";
import { PRESETS, type Group, type PresetName, type Settings } from "./settings";

type SetFn = <G extends Group, K extends keyof Settings[G]>(group: G, key: K, value: Settings[G][K]) => void;

export type PanelActions = {
  fitAll(): void;
  resetCamera(): void;
  zoomTo100(): void;
  goToScreen(n: number): void;
  preset(name: PresetName): void;
  reset(): void;
  copyLink(): Promise<boolean>;
  copyJson(): Promise<boolean>;
  json(): string;
  runBenchmark(): void;
};

export type PanelProps = {
  id: string;
  open: boolean;
  settings: Settings;
  set: SetFn;
  actions: PanelActions;
  stats: LiveStats | null;
  benchmark: { running: string | null; result: BenchmarkResult | null };
  frameCount: number;
  pictureErrors: number;
};

/* ------------------------------------------------------------ fields */

function Range(props: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string; help?: string; name: string }) {
  const id = useId();
  const { label, value, min, max, step, onChange, format, help, name } = props;
  return (
    <div className="field">
      <div className="field-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{format ? format(value) : value}</output>
      </div>
      <input id={id} name={name} type="range" min={min} max={max} step={step} value={value} aria-describedby={help ? `${id}-help` : undefined} onChange={(e) => onChange(Number(e.currentTarget.value))} />
      {help ? (
        <p id={`${id}-help`} className="help">
          {help}
        </p>
      ) : null}
    </div>
  );
}

function Choice<T extends string | number>(props: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void; help?: string; name: string }) {
  const id = useId();
  const { label, value, options, onChange, help, name } = props;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        name={name}
        value={String(value)}
        aria-describedby={help ? `${id}-help` : undefined}
        onChange={(e) => {
          const picked = options.find(([v]) => String(v) === e.currentTarget.value);
          if (picked) onChange(picked[0]);
        }}
      >
        {options.map(([v, text]) => (
          <option key={String(v)} value={String(v)}>
            {text}
          </option>
        ))}
      </select>
      {help ? (
        <p id={`${id}-help`} className="help">
          {help}
        </p>
      ) : null}
    </div>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string; name: string }) {
  const id = useId();
  const { label, checked, onChange, help, name } = props;
  return (
    <div className="field">
      <label className="toggle" htmlFor={id}>
        <input id={id} name={name} type="checkbox" checked={checked} aria-describedby={help ? `${id}-help` : undefined} onChange={(e) => onChange(e.currentTarget.checked)} />
        <span>{label}</span>
      </label>
      {help ? (
        <p id={`${id}-help`} className="help">
          {help}
        </p>
      ) : null}
    </div>
  );
}

function Section({ title, summary, children, open = false }: { title: string; summary: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="section" open={open}>
      <summary>
        <span className="section-title">{title}</span>
        <span className="section-summary">{summary}</span>
      </summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const px = (v: number) => `${v} px`;
const ms = (v: number) => `${v} ms`;
const times = (v: number) => `${v}x`;
const fixed = (n: number) => (v: number) => v.toFixed(n);

/* ------------------------------------------------------------ panel */

export function Panel({ id, open, settings: s, set, actions, stats, benchmark, frameCount, pictureErrors }: PanelProps) {
  const [screenNo, setScreenNo] = useState(1);
  const [copied, setCopied] = useState<string | null>(null);
  const note = async (what: string, job: Promise<boolean>) => setCopied((await job) ? `${what} copied.` : `${what} could not be copied. Select the text below and copy it by hand.`);
  const e = stats?.engine;

  return (
    <aside id={id} className="panel" aria-label="Canvas controls" hidden={!open}>
      <div className="panel-head">
        <h2>Controls</h2>
        <p className="help">Every control changes the running engine at once. Settings are kept in the address bar and in this browser.</p>
        <div className="preset-row" role="group" aria-label="Presets">
          {(Object.keys(PRESETS) as PresetName[]).map((name) => (
            <button key={name} type="button" className="chip" title={PRESETS[name].note} onClick={() => actions.preset(name)}>
              {PRESETS[name].label}
            </button>
          ))}
        </div>
        <div className="preset-row">
          <button type="button" className="chip" onClick={() => actions.reset()}>
            Reset everything
          </button>
          <button type="button" className="chip" onClick={() => void note("Link", actions.copyLink())}>
            Copy link to these settings
          </button>
        </div>
        <p className="help" role="status">
          {copied ?? ""}
        </p>
      </div>

      <Section title="Screens" summary={`${frameCount} screens`} open>
        <Range name="count" label="Screens" value={s.screens.count} min={50} max={2000} step={10} onChange={(v) => set("screens", "count", v)} help="Frames on the canvas. The frame list is rebuilt, so every screen starts again." />
        <div className="preset-row" role="group" aria-label="Screen count presets">
          {[100, 300, 1000].map((n) => (
            <button key={n} type="button" className="chip" aria-pressed={s.screens.count === n} onClick={() => set("screens", "count", n)}>
              {n}
            </button>
          ))}
        </div>
        <Range name="columns" label="Columns" value={s.screens.columns} min={0} max={60} step={1} format={(v) => (v === 0 ? "Automatic" : String(v))} onChange={(v) => set("screens", "columns", v)} help="Screens in each row. Automatic makes the world about as wide as a 16:10 display." />
        <Range name="gap" label="Gap between screens" value={s.screens.gap} min={0} max={400} step={10} format={px} onChange={(v) => set("screens", "gap", v)} help="In world pixels. Rows get 60 more, for the names." />
        <Choice name="device" label="Screen size" value={s.screens.device} options={[["mixed", "Mixed: 8 phones, 1 tablet, 1 desktop in 10"], ["phone", "Phones, 393 by 852"], ["tablet", "Tablets, 820 by 1180"], ["desktop", "Desktops, 1440 by 900"]]} onChange={(v) => set("screens", "device", v)} />
        <Range name="iframes" label="Screens in iframe mode" value={s.screens.iframes} min={0} max={40} step={1} onChange={(v) => set("screens", "iframes", v)} help="Each one loads its own document. Desktop screens are picked first." />
      </Section>

      <Section title="Camera" summary={`${pct(s.camera.minZoom)} to ${pct(s.camera.maxZoom)}`}>
        <div className="action-grid">
          <button type="button" className="chip" onClick={actions.fitAll}>
            Fit all
          </button>
          <button type="button" className="chip" onClick={actions.zoomTo100}>
            Zoom to 100%
          </button>
          <button type="button" className="chip" onClick={actions.resetCamera}>
            Reset camera
          </button>
        </div>
        <form
          className="goto"
          onSubmit={(ev) => {
            ev.preventDefault();
            actions.goToScreen(screenNo);
          }}
        >
          <label htmlFor={`${id}-goto`}>Go to screen</label>
          <input id={`${id}-goto`} name="goto" type="number" min={1} max={frameCount} value={screenNo} onChange={(ev) => setScreenNo(Number(ev.currentTarget.value))} />
          <button type="submit" className="chip">
            Go
          </button>
        </form>
        <Range name="minZoom" label="Smallest zoom" value={s.camera.minZoom} min={0.01} max={1} step={0.01} format={pct} onChange={(v) => set("camera", "minZoom", v)} />
        <Range name="maxZoom" label="Largest zoom" value={s.camera.maxZoom} min={1} max={64} step={1} format={pct} onChange={(v) => set("camera", "maxZoom", v)} />
        <Range name="zoomSpeed" label="Zoom speed" value={s.camera.zoomSpeed} min={0.002} max={0.04} step={0.001} format={fixed(3)} onChange={(v) => set("camera", "zoomSpeed", v)} help="How far one scroll step or pinch step zooms." />
        <Choice name="wheel" label="Plain scroll" value={s.camera.wheel} options={[["pan", "Pans. Best for a trackpad. Pinch zooms."], ["zoom", "Zooms. Best for a mouse wheel. Shift and scroll pans."]]} onChange={(v) => set("camera", "wheel", v)} help="A pinch, or a scroll with Ctrl or Cmd held, always zooms." />
        <Toggle name="inertia" label="Glide after a drag" checked={s.camera.inertia} onChange={(v) => set("camera", "inertia", v)} help="Never glides when reduced motion is on." />
        <Range name="friction" label="Glide friction" value={s.camera.friction} min={0.01} max={0.3} step={0.01} format={pct} onChange={(v) => set("camera", "friction", v)} help="Speed lost in each frame of a glide. Higher stops sooner." />
      </Section>

      <Section title="Level of detail" summary={`${s.lod.maxLive} live, ${s.lod.maxParked} parked`}>
        <Range name="maxLive" label="Live screens, at most" value={s.lod.maxLive} min={0} max={120} step={1} onChange={(v) => set("lod", "maxLive", v)} />
        <Range name="maxParked" label="Parked screens, at most" value={s.lod.maxParked} min={0} max={120} step={1} onChange={(v) => set("lod", "maxParked", v)} help="Hidden but kept in the DOM with their state. The oldest leave first." />
        <Range name="liveInScale" label="Screens come alive from zoom" value={s.lod.liveInScale} min={0.1} max={1.5} step={0.05} format={pct} onChange={(v) => set("lod", "liveInScale", v)} />
        <Range name="hysteresis" label="Hysteresis" value={s.lod.hysteresis} min={0} max={0.3} step={0.01} format={pct} onChange={(v) => set("lod", "hysteresis", v)} help={`A live screen stays live down to ${pct(Math.max(0, s.lod.liveInScale - s.lod.hysteresis))}. The gap stops flicker at the threshold.`} />
        <Range name="tinyScale" label="Smallest picture" value={s.lod.tinyScale} min={0.03} max={0.5} step={0.0125} format={pct} onChange={(v) => set("lod", "tinyScale", v)} help="Every frame keeps one. Used up to this zoom, then the middle picture." />
        <Range name="thumbScale" label="Middle picture" value={s.lod.thumbScale} min={0.05} max={1} step={0.025} format={pct} onChange={(v) => set("lod", "thumbScale", v)} help="Used up to this zoom, then the sharp picture." />
        <Range name="maxThumbs" label="Middle pictures kept" value={s.lod.maxThumbs} min={0} max={2000} step={10} onChange={(v) => set("lod", "maxThumbs", v)} />
        <Range name="maxPreviews" label="Sharp pictures kept" value={s.lod.maxPreviews} min={0} max={500} step={4} onChange={(v) => set("lod", "maxPreviews", v)} />
        <Range name="marginPx" label="Look ahead margin" value={s.lod.marginPx} min={0} max={1200} step={20} format={px} onChange={(v) => set("lod", "marginPx", v)} help="How far outside the view a screen still counts as near. Also the far canvas overscan." />
        <Range name="settleMs" label="Settle after" value={s.lod.settleMs} min={20} max={1000} step={10} format={ms} onChange={(v) => set("lod", "settleMs", v)} help="Time without a camera change before sharp redraws and background work start." />
        <h3>Work in each frame</h3>
        <Range name="mountsStill" label="Mounts while still" value={s.lod.mountsStill} min={0} max={12} step={1} onChange={(v) => set("lod", "mountsStill", v)} />
        <Range name="mountsMoving" label="Mounts while moving" value={s.lod.mountsMoving} min={0} max={8} step={1} onChange={(v) => set("lod", "mountsMoving", v)} />
        <Range name="lateFrameMs" label="Skip mounts after a frame over" value={s.lod.lateFrameMs} min={8} max={100} step={1} format={ms} onChange={(v) => set("lod", "lateFrameMs", v)} />
        <Range name="evictionsPerFrame" label="Unmounts" value={s.lod.evictionsPerFrame} min={1} max={12} step={1} onChange={(v) => set("lod", "evictionsPerFrame", v)} />
        <h3>Staging</h3>
        <Range name="stagingMax" label="Staged at once, at most" value={s.lod.stagingMax} min={1} max={32} step={1} onChange={(v) => set("lod", "stagingMax", v)} help="Screens mounted out of sight only so their picture can be taken." />
        <Range name="stagingPerFrame" label="Staged in one frame" value={s.lod.stagingPerFrame} min={0} max={16} step={1} onChange={(v) => set("lod", "stagingPerFrame", v)} />
        <Range name="stagingGroup" label="Pictures taken together" value={s.lod.stagingGroup} min={1} max={16} step={1} onChange={(v) => set("lod", "stagingGroup", v)} help="The SVG provider draws this many screens in one image." />
      </Section>

      <Section title="Pictures" summary={s.pictures.provider === "auto" ? "Automatic" : s.pictures.provider}>
        <Choice
          name="provider"
          label="Provider"
          value={s.pictures.provider}
          options={[
            ["auto", "Automatic: HTML in Canvas, else SVG"],
            ["html-in-canvas", "HTML in Canvas only"],
            ["svg", "SVG only"],
            ["screenshot", "Screenshot files"],
          ]}
          onChange={(v) => set("pictures", "provider", v)}
          help="HTML in Canvas needs a Chromium flag. Screenshot files come from pnpm demo:shots. Every picture is taken again."
        />
        <p className="help">{pictureErrors ? `${pictureErrors} pictures failed since the page opened.` : "No picture has failed."}</p>
        <Choice name="smoothing" label="Smoothing when scaled" value={s.pictures.smoothing} options={[["auto", "Automatic: low while moving, high when still"], ["high", "Always high"], ["low", "Always low"], ["off", "Off: hard pixels"]]} onChange={(v) => set("pictures", "smoothing", v)} />
        <Range name="previewScale" label="Resolution of the sharp picture" value={s.pictures.previewScale} min={0.125} max={1} step={0.125} format={pct} onChange={(v) => set("pictures", "previewScale", v)} help="One capture makes all three sizes. Every picture is taken again." />
        <Toggle name="warmup" label="Take pictures in the background" checked={s.pictures.warmup} onChange={(v) => set("pictures", "warmup", v)} help="Nearest the view first, only while the camera is still." />
        <Range name="captureConcurrency" label="Pictures in progress, at most" value={s.pictures.captureConcurrency} min={1} max={8} step={1} onChange={(v) => set("pictures", "captureConcurrency", v)} />
        <Range name="fileLoadsMax" label="Files loading, at most" value={s.pictures.fileLoadsMax} min={1} max={24} step={1} onChange={(v) => set("pictures", "fileLoadsMax", v)} />
      </Section>

      <Section title="Rendering" summary={s.rendering.farLayer ? "Far canvas on" : "Far canvas off"}>
        <Toggle name="farLayer" label="Far canvas" checked={s.rendering.farLayer} onChange={(v) => set("rendering", "farLayer", v)} help="Off shows only live screens. For measuring what the pictures cost." />
        <Choice name="maxPixelRatio" label="Pixel ratio cap" value={s.rendering.maxPixelRatio} options={[[0, `None (this display is ${window.devicePixelRatio || 1}x)`], [1, "1x"], [1.5, "1.5x"], [2, "2x"], [3, "3x"]]} onChange={(v) => set("rendering", "maxPixelRatio", v)} help="The far canvas and picture sizes use at most this many device pixels per CSS pixel." />
        <Toggle name="contentVisibility" label="Staging uses content-visibility" checked={s.rendering.contentVisibility} onChange={(v) => set("rendering", "contentVisibility", v)} help="Off lays staged screens out like any other, hidden. For measuring the saving." />
        <Choice name="motion" label="Reduced motion" value={s.rendering.motion} options={[["system", "Follow the system setting"], ["reduce", "On: jump, never glide"], ["full", "Off: glide"]]} onChange={(v) => set("rendering", "motion", v)} />
        <Choice name="willChange" label="will-change on the live layer" value={s.rendering.willChange} options={[["gesture", "While moving"], ["always", "Always"], ["never", "Never"]]} onChange={(v) => set("rendering", "willChange", v)} help="While moving lets text sharpen when the camera stops." />
        <Choice name="origin" label="DOM origin" value={s.rendering.origin} options={[["floating", "Follows the view"], ["fixed", "Fixed at the world origin"]]} onChange={(v) => set("rendering", "origin", v)} help="Fixed shows layout drift far from the origin." />
        <Range name="farZoomSlack" label="Redraw the far canvas after a zoom of" value={s.rendering.farZoomSlack} min={1.02} max={2} step={0.02} format={times} onChange={(v) => set("rendering", "farZoomSlack", v)} help="Until then the compositor stretches the last drawing." />
      </Section>

      <Section title="Input" summary={`Pan button: ${s.input.panButton}`}>
        <Choice name="panButton" label="Mouse button that pans anywhere" value={s.input.panButton} options={[["middle", "Middle"], ["right", "Right"], ["none", "None"]]} onChange={(v) => set("input", "panButton", v)} help="The left button always pans on empty canvas." />
        <Toggle name="spaceDrag" label="Hold Space and drag to pan" checked={s.input.spaceDrag} onChange={(v) => set("input", "spaceDrag", v)} />
        <Range name="keyStep" label="Arrow key step" value={s.input.keyStep} min={8} max={400} step={8} format={px} onChange={(v) => set("input", "keyStep", v)} help="With the canvas focused. Shift moves four times as far." />
      </Section>

      <Section title="Debug" summary={e ? `${stats!.fps} fps` : "Stats"}>
        <Toggle name="tiers" label="Colour every screen by tier" checked={s.debug.tiers} onChange={(v) => set("debug", "tiers", v)} />
        <ul className="legend" aria-label="Tier colours">
          {(Object.keys(TIER_COLOURS) as (keyof typeof TIER_COLOURS)[]).map((t) => (
            <li key={t}>
              <span className="swatch" style={{ background: TIER_COLOURS[t] }} aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
        <Toggle name="outlines" label="Outline mounted screens" checked={s.debug.outlines} onChange={(v) => set("debug", "outlines", v)} help="A solid line round every screen that is real DOM." />
        <Toggle name="hitBoxes" label="Hit test boxes" checked={s.debug.hitBoxes} onChange={(v) => set("debug", "hitBoxes", v)} help="The box a click is tested against. The one under the pointer is red." />
        <Toggle name="cells" label="Spatial index cells" checked={s.debug.cells} onChange={(v) => set("debug", "cells", v)} />
        <Toggle name="hud" label="Full stats on the canvas" checked={s.debug.hud} onChange={(v) => set("debug", "hud", v)} help="Frames a second, frame time, long tasks, heap, DOM nodes, tiers and the picture queue. Sampled once a second." />

        <h3>Benchmark</h3>
        <p className="help">Fits every screen, zooms in, pans three widths and back, and zooms out. About six seconds. Leave the mouse still.</p>
        <button type="button" className="chip wide" onClick={actions.runBenchmark} disabled={!!benchmark.running}>
          {benchmark.running ? `Running: ${benchmark.running}` : "Run benchmark"}
        </button>
        <div role="status" aria-live="polite" className="bench-result">
          {benchmark.result ? (
            <dl className="stat-list">
              <dt>Frames a second</dt>
              <dd data-testid="bench-fps">{benchmark.result.fps.toFixed(1)}</dd>
              <dt>Median frame</dt>
              <dd>{benchmark.result.frameMsP50.toFixed(1)} ms</dd>
              <dt>95th percentile frame</dt>
              <dd>{benchmark.result.frameMsP95.toFixed(1)} ms</dd>
              <dt>Worst frame</dt>
              <dd>{benchmark.result.frameMsMax.toFixed(1)} ms</dd>
              <dt>Frames over 50 ms</dt>
              <dd>{benchmark.result.slowFrames}</dd>
              <dt>Long tasks</dt>
              <dd>{benchmark.result.longTasks ?? "Not reported by this browser"}</dd>
              <dt>Screens brought alive</dt>
              <dd>{benchmark.result.promotions}</dd>
              <dt>Far canvas drawings</dt>
              <dd>{benchmark.result.farDraws}</dd>
            </dl>
          ) : null}
        </div>

        <h3>Settings and stats as JSON</h3>
        <button type="button" className="chip wide" onClick={() => void note("JSON", actions.copyJson())}>
          Copy JSON
        </button>
        <pre className="json" tabIndex={0} aria-label="Settings and stats as JSON">
          {actions.json()}
        </pre>
      </Section>
    </aside>
  );
}
