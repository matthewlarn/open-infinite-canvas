# Architecture

One idea carries the whole design. A canvas can hold hundreds of live screens if only a few of them are awake. The rest are pictures.

## The parts

```
viewport (one element, owns every gesture)
├── far layer      one <canvas>, a little larger than the viewport
│                  holds a picture of every frame in view
│                  moved by the compositor between drawings
├── screen list    one entry per frame, mounted or not
│                  what a keyboard and a screen reader walk
└── live layer     one transformed element
                   holds only live, parked and staging frames as real DOM
```

The engine has no framework in it. It owns:

1. **The camera.** `{ x, y, z }` in plain numbers. A world point maps to the screen as `screen = world * z + (x, y)`.
2. **The scene.** Frames with world rectangles, and a grid index over them.
3. **The level of detail.** Which tier each frame is in, inside fixed budgets.
4. **Pictures.** Three sizes for each frame, made by a provider, held in bounded caches.
5. **The far renderer.** One 2D canvas and one `drawImage` for each frame in view.
6. **Input.** Wheel, pinch, drag, touch and keys.
7. **Reading order and neighbours.** For the keyboard and for screen readers.

A view layer is thin. It asks the engine which frames to mount and in which mode, and tells the engine the element of each one. `@open-infinite-canvas/react` is one view layer. `mountCanvas` in the core is another, in plain DOM.

## Source map

| File in `packages/core/src` | What it holds |
|---|---|
| `camera.ts` | Camera maths: zoom to a point, fit a rectangle, interpolate in log space |
| `spatial.ts` | `GridIndex`, a uniform grid over frame rectangles |
| `lod.ts` | `LodScheduler`, the level of detail scheduler. No DOM. |
| `engine.ts` | `CanvasEngine`: the frame loop, settling, pictures, background work |
| `far-renderer.ts` | Draws pictures, placeholders, outlines and names on the far canvas |
| `pictures/` | The providers: `html-in-canvas.ts`, `svg.ts`, `screenshot.ts`, and `auto.ts` which picks |
| `input.ts` | Pointer, wheel, pinch and key handling |
| `binding.ts` | `connectCanvas` (keyboard list, focus, announcements) and `mountCanvas` (plain DOM view layer) |
| `layout.ts` | `layoutRows`, `readingOrder`, `neighbourIndex`. Pure functions. |
| `styles.css` | The few CSS rules the canvas needs |

## The four tiers

| Tier | In the DOM | Costs | Shown as |
|---|---|---|---|
| Live | Yes, visible | Whatever the screen costs | The real screen |
| Parked | Yes, `display: none` | Memory only | Its picture |
| Picture | No | One bitmap | Its picture |
| Placeholder | No | Nothing | A flat box with a few bars |

A fifth state, staging, is internal. A staging frame is mounted for a moment under `content-visibility: hidden` so its picture can be taken. It is never laid out in the page or painted.

### Who is live

| Zoom | What a frame is |
|---|---|
| 45% and up | Live, if inside the budget. Nearest the centre of the view first. The selected frame always wins. |
| 35% to 45% | Whatever it already was. The gap stops a frame flickering between tiers. |
| Under 35% | Picture, or parked if it was live a moment ago |

Defaults: 24 live, 24 parked, 400 middle pictures, 64 sharp pictures. All are settings in `lod`.

```ts
createCanvas({ lod: { maxLive: 12, maxParked: 48 } })
```

### Rate limits

Mounting a screen is the one expensive step, so it is rationed.

- One mount in a frame while the camera moves.
- None if the last frame took longer than 24ms.
- Two in a frame when the camera is still.
- Two evictions in a frame.

A parked frame past the budget is unmounted, oldest first. If someone used the screen, its picture is taken on the way out, so the far view shows what they left. A screen that is mounted again after eviction starts from its declared state.

## Pictures

Three sizes are kept for each frame: one eighth, one quarter and one half scale. The far renderer draws the smallest one that is not stretched by more than a tenth. The smallest is kept for every frame, so the whole world can always be drawn. The other two are caches, and the ones farthest from the view are dropped first.

One drawing of a screen gives all three sizes.

### When a picture is taken

1. In the background, nearest the view first, while the camera is still.
2. When a screen that somebody used stops being live.
3. On demand, when the zoom needs a sharper size than a visible frame has.

Nothing is taken while the camera moves.

### Providers

A provider turns a screen into a bitmap. The engine does not care how.

| Provider | How | Fidelity | Works in |
|---|---|---|---|
| `htmlInCanvasProvider()` | The browser paints a copy of the screen into a canvas, through the HTML in Canvas proposal | Exact | Chromium behind a flag |
| `svgProvider()` | The screen and the page's CSS are copied into an SVG `foreignObject` image | Good. Misses cross-origin images, canvas pixels, video, and fonts that are not inlined. | Every browser with SVG `foreignObject`. Measured in Chromium only. |
| `screenshotProvider({ url })` | Loads a file made ahead of time | Exact when the file was made, stale after | Everywhere |

`autoProvider()` is the default. It uses HTML in Canvas where the browser has the drawing call, and SVG everywhere else. If an HTML in Canvas picture fails once, it uses SVG from then on.

A frame can carry its own `picture` address. The engine loads that file and never mounts the screen just to draw it zoomed out. Once somebody has used the screen, the file is out of date and the provider takes over.

```ts
const frames = [{ id: "orders", name: "Orders", x: 0, y: 0, w: 1440, h: 900, picture: "/shots/orders.png" }]
```

Notes on each:

- **SVG** embeds the page's whole stylesheet in every image. With 400 KB of CSS a single picture took 16ms of main thread time in the spike. So the provider draws several screens in one image, which brought that to under 6ms.
- **HTML in Canvas** only draws an element that is a child of the canvas. The provider puts a copy of the screen inside a hidden canvas for two frames. The screen itself is never moved. In the flagged Chromium build the canvas is tainted afterwards, so its pixels cannot be read or saved. The engine only draws pictures, so that does not matter to it.
- **Screenshots** are the cheapest path at run time. A build step that already screenshots every screen can feed this directly.

Write your own by returning an object with `name` and `capture`.

## The frame loop

The engine draws only when something changed. One engine frame does this:

1. Writes the camera to the live layer as one `transform`.
2. Asks the grid which frames are near the view.
3. Runs the scheduler, which moves a few frames between tiers.
4. If the camera is still, does one small unit of background work.
5. Moves the far canvas, or draws it again.

The far canvas is retained. It is a little larger than the viewport, so a pan or a small zoom only moves it, which the compositor does without the main thread. It is drawn again when moving it would uncover an edge, when the zoom has changed by more than 12%, when a picture arrives, and when the view settles.

Every frame in view is drawn on the far canvas, live or not. A live screen sits above the canvas and covers its own picture. So a screen coming alive or being parked never forces a redraw.

### Settling

After 140ms with no camera change the engine:

- drops `will-change` so the browser redraws live text sharp at the new scale
- snaps the camera to whole device pixels
- draws the far layer again at high quality
- trims the picture caches
- moves the DOM origin if needed
- starts background work

### Far coordinates

Browsers lay out on a fixed grid and stop at about 33 million pixels. With one transformed parent, a screen stops being drawn once its world position times the zoom passes that. The engine keeps world coordinates in plain numbers and moves the DOM origin near the view when the view settles. A frame's `left` and `top` then stay small however far out in the world it is.

## The grid index

A uniform grid over world space. Each cell lists the frames that touch it. A query is a handful of cell lookups. A grid suits this better than a tree: frames move rarely, and the layout is close to regular.

## Rules the measurements confirmed

- The camera never passes through React. Only a tier change renders, and it is marked as a transition.
- A frame is `contain: strict` with a fixed size. Nothing inside can cost anything outside.
- The DOM origin follows the view.
- The far canvas is retained and moved, not redrawn, on most frames.
- Pictures are held in ordinary memory, not as one GPU texture each.
- Background work only runs while the camera is still.

## The React binding

`<InfiniteCanvas>` renders the viewport, the far canvas, the empty list and the live layer. It subscribes to the engine and renders one host element for each mounted frame.

- A live frame renders normally.
- A parked frame is wrapped in `<Activity mode="hidden">` where React has it (19.2 and later). State is kept and effects are turned off.
- On React 18, and on React 19 before 19.2, there is no `Activity`. The parked frame is hidden with `display: none`. State is kept. Effects and timers go on running. `hasActivity` tells you which you have.
- `inert` is set as a DOM property on every frame that is not live, so its controls are out of the tab order on any React version.

Hooks: `useInfiniteCanvas()` returns the engine. `useFrame()` returns the frame and its mode from inside a screen.

## Iframe mode

Screens render in the page's own document. That is the default and the cheap path: one copy of the app, one stylesheet, one main thread.

Give a frame a `src` and that one screen is an iframe instead.

```ts
{ id: "prod", name: "Production", x: 0, y: 992, w: 1440, h: 900, src: "/app/orders" }
```

What to know:

- The same tiers apply. The iframe is created when the frame is mounted and removed when it is evicted, so the page inside starts again.
- A parked iframe is hidden. The page inside is not paused.
- The SVG provider can picture a same-origin iframe by copying its document. It cannot see into a cross-origin one. Give such a frame a `picture`.
- A staging iframe is not painted, so the page inside may not have rendered when its picture is taken. If a picture comes out empty, give the frame a `picture`.
- Events inside an iframe do not reach the canvas. Scroll and pinch over a live iframe go to the page inside it.
- Each iframe loads its own copy of whatever it points at. In the spike, 300 iframes used 938 MB against 420 MB for one document. Use the mode for the screens that need it.

## What is not built

- Anchors and a chrome layer, for things pinned to a point on a frame at a constant size.
- Moving and resizing frames, and marquee selection.
- Frames that size to their content.
- A portal container for each frame, so a dialog opened in a screen renders inside its frame.
- Pictures kept on disk between visits.
- Comments, device frames, a developer bar and design handoff, which are out of scope for this package.
