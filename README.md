# open-infinite-canvas

An infinite canvas that holds hundreds of live, interactive screens and stays smooth.

It treats screens like browser tabs. A few are awake as real DOM. The rest are pictures drawn on one canvas. Zoom in and a picture becomes the real screen. Zoom out and it goes back to being a picture.

Status: version 0.1.0, not published to npm yet. Measured only on headless Chromium with no real GPU. See [the results](docs/results.md).

## What is in the box

- `open-infinite-canvas` is the engine. No framework and no runtime dependencies.
- `@open-infinite-canvas/react` is the React binding, for React 18 and 19.
- `apps/demo` is a demo with 300 screens of a tool library app, and a control panel for every engine setting.
- `bench` holds the Playwright benchmarks, the baselines and the behaviour checks.

## Use it with React

```tsx
import { InfiniteCanvas } from "@open-infinite-canvas/react"
import "open-infinite-canvas/styles.css"

const frames = [
  { id: "cart", name: "Cart", x: 0, y: 0, w: 393, h: 852 },
  { id: "cart-empty", name: "Cart, empty", x: 473, y: 0, w: 393, h: 852 },
]

const renderFrame = (frame) => <CartScreen empty={frame.id === "cart-empty"} />

export function Board() {
  return <InfiniteCanvas label="Checkout redesign" frames={frames} renderFrame={renderFrame} />
}
```

Give the parent element a size. Keep `frames` and `renderFrame` stable between renders.

## Use it without a framework

```ts
import { layoutRows, mountCanvas } from "open-infinite-canvas"
import "open-infinite-canvas/styles.css"

const frames = layoutRows(screens.map((s) => ({ id: s.id, name: s.title, w: 393, h: 852 })))

mountCanvas(document.getElementById("stage"), {
  label: "Every screen",
  frames,
  renderFrame(frame, host) {
    host.append(buildScreen(frame.id))
  },
})
```

## How it works

Every frame is in one of four tiers.

| Tier | What it is | Default budget |
|---|---|---|
| Live | Real DOM, visible, interactive | 24 |
| Parked | Real DOM, hidden, state kept | 24 |
| Picture | A bitmap on the far canvas | Every other frame |
| Placeholder | A flat box, until the first picture is taken | |

Both budgets are settings: `options={{ lod: { maxLive: 12, maxParked: 48 } }}`. Change them while the canvas runs with `engine.reconfigure({ lod: { maxLive: 8 } })`.

Pictures come from a provider. The default tries HTML in Canvas and falls back to SVG, so Safari and Firefox keep working. A frame can also name a screenshot made at build time.

| Provider | Fidelity | Works in |
|---|---|---|
| `htmlInCanvasProvider` | Exact. The browser paints the real elements. | Chromium behind a flag, for now |
| `svgProvider` | Good. Misses cross-origin images, canvas pixels and video. | Every browser with SVG `foreignObject` |
| `screenshotProvider`, or `picture` on a frame | Exact when the file was made | Everywhere |

A screen renders in the page's own document. Give a frame a `src` and that one screen runs in an iframe instead.

More detail is in [docs/architecture.md](docs/architecture.md).

## Controls

| Do this | To |
|---|---|
| Scroll, or drag with two fingers | Pan |
| Pinch, or hold Ctrl or Cmd and scroll | Zoom toward the pointer |
| Drag empty canvas | Pan, with a short glide on release |
| Click a screen | Select it |
| Double click a screen | Zoom to it |
| Tab, then the arrow keys | Move between screens |
| Enter | Open the selected screen and move focus into it |
| Escape | Come back out |
| Plus, minus, 0, 1, 2 | Zoom in, zoom out, 100%, fit everything, fit the selection |

People who ask for reduced motion get jumps in place of glides. Accessibility notes are in [docs/accessibility.md](docs/accessibility.md).

## Try it on your laptop

```
pnpm install
pnpm demo
```

Open http://localhost:5311 and select **Controls**. The panel changes the running engine: screen count and layout, camera, level of detail, pictures, rendering and input. It also has debug overlays, live stats, presets and a benchmark. Settings are saved in the address bar and in the browser.

To open it from another device on your network, run `pnpm demo:host`.

Every control is described in [docs/controls.md](docs/controls.md).

## Develop

```
pnpm install
pnpm build        # both packages
pnpm test         # unit tests
pnpm test:e2e     # Playwright checks, on the built packages
pnpm bench        # the benchmark, then a comparison with the reference run
pnpm demo         # the demo at http://localhost:5311
pnpm demo:host    # the same, served on your local network
pnpm demo:shots   # screenshot files for the demo's screenshot provider
```

The Playwright scripts use a Chromium that is already installed. Set `PLAYWRIGHT_BROWSERS_PATH` if yours is somewhere unusual.

## Not built

Comments, device frames, a developer bar and design handoff are out of scope. Frames cannot be dragged, and there is no marquee selection. Touch input is written but untested. Nothing here has been tried with a real screen reader yet.

## Licence

MIT. See [LICENSE](LICENSE).
