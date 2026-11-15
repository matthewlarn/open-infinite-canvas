# Measured results

> **Read this before quoting a number.** Every number on this page comes from headless Chromium on a machine with **no real GPU**. Chrome drew every pixel on the CPU, or through a graphics card emulated in software. Frame rates on a real laptop were not measured and will differ. Safari and Firefox were not measured at all.

This page has two parts.

1. **The spike.** The tables the research spike produced on 2026-11-15, copied from its `RESULTS.md`. The spike is the code this package was made from.
2. **The packaged build.** The same benchmark run again on the built packages in this repository, beside the spike's numbers.

The spike's tables were written by its report script from raw JSON. The packaged build's run 2 tables are written by `bench/scripts/compare.cjs`. The short table that puts the two runs side by side was copied from the same JSON. The raw JSON of the spike's main run is in `bench/reference/bench.json`.

Three names are used throughout:

- **Engine** is this package.
- **Today** is the tuned form of the usual approach: every screen mounted in one transformed parent with `will-change: transform`, the zoom published as the custom property `--z`, a fence that stops that property restyling every screen, and `content-visibility: auto`. It is what the project that commissioned the research shipped at the time.
- **Naive** is every screen mounted in one transformed parent with `will-change: transform`, and nothing else.

## Part 1. The spike

### The machine

- Browser: headless Chromium 141.0.7390.37, driven by Playwright 1.56.1.
- Machine: 4 cores, Intel(R) Xeon(R) Processor @ 2.10GHz, 15.7 GB, Linux 6.18.44-fc-v470 x64.
- Viewport: 1440 by 900 at device pixel ratio 1.
- An idle page draws a frame every 16.7ms here, so 60 fps is the most any variant can score.
- **There is no GPU.** Chrome reports `gpu_compositing: disabled_software` and `rasterization: disabled_software`. Every pixel is composited and rastered on the CPU.

What that means for these numbers:

- Frame rates on a real laptop will be higher for every variant. They were not measured.
- Moving a large cached layer is nearly free on a GPU and expensive here. That hurts the baselines more than the engine, which draws small bitmaps. The gap between them on a real laptop is probably smaller than the gap in these tables. How much smaller is not known.
- Work that no GPU helps with is measured faithfully: script, style, layout, DOM size, heap, mount time and load time. The engine's gains there carry over to any machine.
- A later section repeats the main paths through Chrome's GPU pipeline with the graphics card emulated in software. That is a second stand-in for a real laptop, biased the other way.
- Only Chromium was measured. Safari and Firefox were not.

### What was compared

Every variant shows the same screens at the same world positions. One scripted camera path drives all of them.

- **Engine.** The recommended design. A far layer of pictures on one canvas, a live layer of real DOM for at most 24 screens, and a budget between them. In this repository the code is in `packages/core/src/`.
- **Today.** Every screen mounted in one transformed parent with `will-change: transform`, the zoom published as `--z`, the zoom fence, and `content-visibility: auto`.
- **Naive.** Every screen mounted in one transformed parent with `will-change: transform`. Nothing else.

The demo is a tool library app. 29 screen and state combinations repeat with different content: forms, lists, a sortable table, charts drawn in SVG, long articles, a calendar, a chat, loading skeletons that animate, and a desk screen with a ticking clock. Eight in ten frames are phones at 393 by 852. The rest are tablets and desktops.

The demo averages 145.8 elements a screen across 290 screens. The heaviest template has 333 and the lightest 49. Real screens are heavier than these. That costs the baselines more than it costs the engine, because the engine mounts at most 24 of them.

The four paths:

- **Zoom sweep**, 6 seconds. From every screen in view to one screen at 100%, and back out.
- **Pan, zoomed out**, 4 seconds. Corner to corner with dozens to hundreds of screens in view.
- **Pan at 50%**, 5 seconds. Along a row with about twenty screens in view.
- **Pan at 100%**, 5 seconds. Across six screens with two or three in view.

Each path ran 2 times in a row on a freshly loaded page, after any background work had finished. Tables show the median run. Every run is in `bench/reference/bench.json`.

A frame is counted when the page's animation frame callback runs. The camera is moved from that callback, so this is the rate at which the picture on screen changes. The spike checked it against a browser trace, and the two agreed to within 0.3 frames a second.

### Frame rate

Frames per second on four scripted camera paths. 60 is the most this machine can show.

| Scripted path | Variant | 100 screens | 300 screens | 1,000 screens |
|---|---|---|---|---|
| **Zoom from everything to one screen and back** | Engine (recommended) | **58.5** | **59.3** | **58.8** |
|  | Today (ships now) | 38.4 | 19.4 | 5.3 |
|  | Naive | 19.3 | 6.5 | 1.6 |
| **Pan, zoomed out** | Engine (recommended) | **60.0** | **60.0** | **60.0** |
|  | Today (ships now) | 42.1 | 12.3 | 2.2 |
|  | Naive | 20.9 | 7.0 | 1.3 |
| **Pan at 50%** | Engine (recommended) | **60.0** | **60.0** | **60.0** |
|  | Today (ships now) | 59.8 | 59.4 | 30.5 |
|  | Naive | 52.8 | 12.0 | 3.5 |
| **Pan at 100%** | Engine (recommended) | **60.0** | **60.0** | **60.0** |
|  | Today (ships now) | 60.0 | 60.0 | 60.0 |
|  | Naive | 58.0 | 24.4 | 8.2 |

- **100 screens.** The engine's slowest path ran at 58.5 fps. Today's slowest ran at 38.4. The naive baseline's slowest ran at 19.3.
- **300 screens.** The engine's slowest path ran at 59.3 fps. Today's slowest ran at 12.3. The naive baseline's slowest ran at 6.5.
- **1,000 screens.** The engine's slowest path ran at 58.8 fps. Today's slowest ran at 2.2. The naive baseline's slowest ran at 1.3.
- **Ready to use.** 147ms for the engine at 1,000 screens. 6.8 seconds for today's approach.
- **Size.** 2,016 DOM elements for the engine at 1,000 screens. 150,637 for today's approach. 422 MB of browser memory against 1,000 MB.
- **The catch.** The engine spends 12.6 seconds in the background taking a picture of every one of the 1,000 screens. Until a screen has its picture it is drawn as a placeholder.
- **No GPU.** These numbers come from a machine that draws everything on the CPU. A later section repeats the paths through Chrome's GPU pipeline on an emulated graphics card, where the picture is more mixed.

### Load, memory, DOM size and layers

- **Ready** is from navigation to the first painted frame the page can be used at.
- **Background** is work after that. Only the engine has any: it takes a picture of every screen, nearest the view first.
- **Heap** is the JavaScript heap after a forced collection.
- **Browser memory** is the proportional set size of every Chrome process, so it includes DOM, layout, bitmaps and compositor memory.
- **Layers** is the compositor's layer count with every screen in view. Megapixels is the area those layers cover at full size.

| Screens | Variant | Ready | Longest task while loading | Background | DOM elements | Heap | Browser memory | Layers | Layer megapixels |
|---|---|---|---|---|---|---|---|---|---|
| 100 | Engine (recommended) | 116ms | 0ms | 1.2s | 216 | 3.3 MB | 288 MB | 0 | 0.0 |
|  | Today (ships now) | 533ms | 320ms | none | 15,362 | 7.4 MB | 266 MB | 386 | 153.0 |
|  | Naive | 699ms | 445ms | none | 15,362 | 7.2 MB | 265 MB | 406 | 139.2 |
| 300 | Engine (recommended) | 111ms | 0ms | 3.3s | 616 | 3.8 MB | 351 MB | 0 | 0.0 |
|  | Today (ships now) | 1,731ms | 874ms | none | 45,527 | 15.7 MB | 428 MB | 1,145 | 484.0 |
|  | Naive | 1,828ms | 848ms | none | 45,527 | 15.8 MB | 420 MB | 1,205 | 409.1 |
| 1,000 | Engine (recommended) | 147ms | 53ms | 12.6s | 2,016 | 4.9 MB | 422 MB | 0 | 0.0 |
|  | Today (ships now) | 6,754ms | 3,733ms | none | 150,637 | 47.6 MB | 1,000 MB | 4,632 | 2,040.8 |
|  | Naive | 6,086ms | 2,846ms | none | 150,637 | 47.6 MB | 958 MB | 4,032 | 1,357.6 |

- At 100 screens the engine uses more browser memory than today's approach: 288 MB against 266 MB.
- At 300 screens the engine uses less browser memory than today's approach: 351 MB against 428 MB.
- At 1,000 screens the engine uses less browser memory than today's approach: 422 MB against 1,000 MB.
- Pictures cost memory too. At 100 screens they cost about as much as the DOM they replace. The saving appears as the count grows.
- The engine has no compositor layers of its own when zoomed out. It is one canvas.

### The engine's own cost

| Screens | Engine work in a frame, mean | Worst | Smallest pictures held | Middle size | Sharp size | Picture memory | Pictures taken a second | Time for one picture |
|---|---|---|---|---|---|---|---|---|
| 100 | 0.07ms | 5.7ms | 100 | 100 | 66 | 46.9 MB | 74.1 | 7.0ms |
| 300 | 0.09ms | 4.6ms | 300 | 300 | 79 | 80.3 MB | 87.9 | 6.1ms |
| 1,000 | 0.14ms | 15.9ms | 1,000 | 401 | 65 | 101.4 MB | 78.2 | 6.4ms |

- Engine work in a frame is the time inside the engine's own frame callback: the camera writes, the grid query, the level of detail pass and, when needed, drawing the far canvas. The mean and the worst are over the four paths.
- Pictures are taken four to eight screens at a time. Time for one picture is the group's wall time divided by its size.
- The middle and sharp sizes are bounded caches. The smallest size is kept for every screen.

### The same paths through Chrome's GPU pipeline

Every table above comes from Chrome's software compositor, which is what a machine with no GPU gets by default. Chrome can be told to use its GPU pipeline anyway, drawing through a software implementation of the graphics API (SwiftShader). That is the code path a real laptop runs: tiles are GPU textures, the canvas is GPU backed, and the compositor moves layers instead of repainting them.

The switches were `--use-angle=swiftshader --ignore-gpu-blocklist --enable-gpu-rasterization --enable-unsafe-swiftshader`.

**This is not what a real GPU scores.** The graphics card is emulated on the same four cores, so everything that touches pixels is many times slower than on hardware. It is a second imperfect stand-in, biased the other way: here, drawing new content is very expensive and moving existing content is cheap.

| Scripted path | Variant | 100 screens | 300 screens |
|---|---|---|---|
| **Zoom from everything to one screen and back** | Engine (recommended) | 42.2 fps, p95 67ms | 45.0 fps, p95 33ms |
|  | Today (ships now) | 7.6 fps, p95 333ms | 5.6 fps, p95 400ms |
|  | Naive | 11.0 fps, p95 300ms | 4.0 fps, p95 867ms |
| **Pan, zoomed out** | Engine (recommended) | 60.0 fps, p95 17ms | 60.0 fps, p95 17ms |
|  | Today (ships now) | 23.1 fps, p95 83ms | 8.6 fps, p95 217ms |
|  | Naive | 8.3 fps, p95 233ms | 4.0 fps, p95 1,083ms |
| **Pan at 50%** | Engine (recommended) | 23.9 fps, p95 117ms | 23.8 fps, p95 83ms |
|  | Today (ships now) | 30.4 fps, p95 83ms | 24.2 fps, p95 133ms |
|  | Naive | 26.7 fps, p95 83ms | 11.5 fps, p95 133ms |
| **Pan at 100%** | Engine (recommended) | 36.7 fps, p95 67ms | 29.5 fps, p95 67ms |
|  | Today (ships now) | 55.2 fps, p95 17ms | 46.8 fps, p95 33ms |
|  | Naive | 38.9 fps, p95 50ms | 23.1 fps, p95 67ms |

| Screens | Variant | Ready | Background | Browser memory | Of which the GPU process | Layers |
|---|---|---|---|---|---|---|
| 100 | Engine (recommended) | 119ms | 1.1s | 331 MB | 114 MB | 0 |
|  | Today (ships now) | 649ms | none | 360 MB | 133 MB | 386 |
|  | Naive | 660ms | none | 358 MB | 134 MB | 406 |
| 300 | Engine (recommended) | 121ms | 3.0s | 424 MB | 148 MB | 0 |
|  | Today (ships now) | 3,003ms | none | 596 MB | 211 MB | 1,145 |
|  | Naive | 3,376ms | none | 614 MB | 232 MB | 1,205 |

- **100 screens.** The engine is ahead of today's approach on: zoom from everything to one screen and back, pan, zoomed out. Behind on: pan at 50%, pan at 100%. Within a tenth on: nothing.
- **300 screens.** The engine is ahead of today's approach on: zoom from everything to one screen and back, pan, zoomed out. Behind on: pan at 100%. Within a tenth on: pan at 50%.
- Zoomed out, the engine moves one canvas and today's approach has hundreds of screens' worth of content to keep drawn. That holds in both stand-ins.
- Close in, the engine mounts each screen as it comes into view, and here each newly mounted screen is rastered by an emulated graphics card. Today's approach drew those screens when the page loaded. On hardware that raster is fast. How the two compare close in on a real GPU is not known from this.
- Together the two stand-ins bracket the answer. Neither replaces a run on a real laptop.

### Text crispness

The same text-heavy screen was drawn five ways. For each, the camera was set to 100%, then moved to the zoom under test. Once the page was still, the same 600 by 400 pixel area was captured.

The score is the variance of the Laplacian of the image's brightness. Sharp edges score high. A stretched bitmap scores low. A bitmap shrunk without filtering scores too high, because it is jagged. Each score is divided by the reference at the same zoom. The reference is the browser drawing the page fresh at that scale with no layer hint. **1.00 means the same as the browser's own fresh drawing.**

| How it is drawn | 12.5% | 25% | 50% | 75% | 100% | 150% | 200% | 300% | 400% |
|---|---|---|---|---|---|---|---|---|---|
| Browser redraws at every scale (no will-change) | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| Today: will-change always on the parent | 1.35 | 2.97 | 0.96 | 0.64 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| Engine, view settled | 0.54 | 0.78 | 1.01 | 1.01 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| Engine, as drawn during a gesture (will-change held) | 0.54 | 0.78 | 0.97 | 0.65 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| Engine, pictures only (no live screens) | 0.54 | 0.78 | 0.97 | 0.14 | 0.09 | 0.04 | 0.02 | 0.01 | 0.00 |

- **Above 100%, every live approach is sharp.** Today's approach scores 1.00, 1.00, 1.00, 1.00 at 150%, 200%, 300%, 400%. Chromium 141 redraws a `will-change: transform` layer when it is scaled up. Google's 2016 sample page says it does not. That page no longer describes this browser.
- **Below 100%, `will-change` keeps the full size bitmap and shrinks it.** Today's approach scores 0.64 at 75%, which is softer than a fresh drawing, and 2.97 at 25%, which is jagged. Full size bitmaps of a zoomed out canvas are also where its memory goes.
- **The engine matches the reference from 50% up once the view settles.** It scores 1.01, 1.01, 1.00, 1.00, 1.00 at 50%, 75%, 100%, 200% and 400%. It drops `will-change` when the camera stops.
- **During a gesture the engine looks like today's approach.** With the hint held it scores 0.65 at 75%. That lasts until 140ms after the camera stops.
- **A picture is soft above its own scale.** With no live screens at all the engine scores 0.14 at 75% and 0.09 at 100%, because the sharpest picture is half size. This is what a screen over the live budget looks like. The budget has to cover what fits on screen at reading size.
- **Zoomed out, a picture is smoother than live text.** It scores 0.78 at 25% and 0.54 at 12.5% against live text drawn that small. Text four pixels tall is not readable either way.

### Behaviour checks

Real input events against the engine with 300 screens. 18 of 18 passed.

| Check | Result | What was measured |
|---|---|---|
| Zoom to cursor | Pass | zoom 0.060 to 64.000, the point under the pointer moved 0.240px |
| Wheel pans | Pass | moved -120.0, -80.0 for a wheel of 120, 80 |
| Drag pans | Pass | moved 263.0, 158.0 for a drag of 100, 60 (a glide may add to it) |
| Click selects the picture under the pointer | Pass | clicked frame 71, selected 71 |
| Double click opens the screen and it comes alive | Pass | zoom 0.94, 15 live screens |
| Typed text survives while the screen is parked | Pass | tier while zoomed out: parked. Value on return: "needle nose pliers" |
| A live screen keeps running | Pass | clock went from 09:41:06 to 09:41:08 in 2.2s |
| A parked screen stops running | Pass | clock read 09:41:08 then 09:41:08 after 3.2s parked |
| A parked screen resumes from where it stopped | Pass | clock on return: 09:41:08 |
| Mounted screens stay inside the budget | Pass | 21 live, 24 parked, 159 unmounted on the way |
| An evicted screen starts again from its declared state | Pass | same DOM node on return: false. Search field on return: "" (it was "spirit level") |
| Tab then arrow keys move between screens | Pass | started on "Catalogue, default 04", arrived on "Join, filled 05", selection follows focus: true |
| Enter opens the screen and moves focus inside it | Pass | focus is on a BUTTON inside f136 (live) |
| Escape returns to that screen's entry in the list | Pass | focus returned to f136 |
| Every screen is in the accessibility tree, mounted or not | Pass | 300 entries in the list "Harbor Street Tool Library, every screen: 300 screens" while 28 of 300 screens are mounted. Canvas node: group "Harbor Street Tool Library, every screen" |
| Selection is announced | Pass | live region says: "Join, filled 05. Screen 111 of 300." |
| Arrow keys and plus work on the focused canvas | Pass | zoom 0.944 to 1.180 |
| A far layer moved by the compositor lines up with a fresh drawing | Pass | drawings before the move 3, after it 3, after a forced redraw 4. Mean difference from a fresh drawing 1.22 levels. The same with a 3px shift 3.46 |

These 18 checks are now Playwright tests in `bench/tests/behaviour.spec.ts`.

### What is proven and what is not

**Measured here**, on headless Chromium with no GPU:

- The engine ran every path at 58.8 fps or better with 1,000 screens on the canvas.
- It was ready in 147ms at 1,000 screens, with 2,016 DOM elements and a 4.9 MB heap.
- Taking a picture of all 1,000 screens took 12.6 seconds in the background.
- Today's approach on the same 1,000 screens took 6.8 seconds to be ready, held 150,637 DOM elements, 4,632 compositor layers and 1,000 MB of browser memory, and its slowest path ran at 2.2 fps.
- The frame counts agree with a browser trace.
- Through Chrome's GPU pipeline on an emulated graphics card, at 300 screens, the engine ran the zoomed out pan at 60.0 fps against 8.6 for today's approach, and the pan at 100% at 29.5 against 46.8.
- 18 of 18 behaviour checks passed with real input events: zoom to cursor, panning, selection, keyboard travel, the accessibility tree, state kept while parked, effects stopped while parked, and a fresh start after eviction.
- Once the view settles, text matches the browser's own fresh drawing from 50% to 400%.
- With the origin following the view, a screen 30 million pixels from zero is drawn where it should be at every zoom tested.
- An early build of HTML in Canvas painted every demo screen to a canvas, at a median of 1.4ms each.

**Not measured, so not claimed:**

- Frame rates on a machine with a GPU. This is the largest gap. Every number here comes from four processor cores, with the graphics card either absent or emulated.
- Safari and Firefox.
- A display with a device pixel ratio of 2. Pictures need four times the memory for the same sharpness there.
- Screens built from a real component library. The demo screens are plain React and CSS, lighter than most design systems.
- The HTML in Canvas picture path on a browser that ships it. Only an early flagged build was probed.
- Picture fidelity. The pictures were checked by eye and by a blank test, not pixel by pixel against the live screen.
- Screen readers. The accessibility tree and focus order were checked by script, not with VoiceOver, NVDA or JAWS.
- Touch input and phones.
- Pictures kept on disk between visits. Every load in this spike starts cold.
- Iframes on another site. Only same origin iframes were measured, and those share the page's main thread.
- Comment pins, marquee selection, moving frames and frames that size to their content. They are designed and not built.

## Part 2. The packaged build

<!-- packaged:start -->
The benchmark was run twice on 2026-11-15 against the built packages (`packages/core/dist` and `packages/react/dist`), on the same machine as the spike, with `pnpm bench`. Each run takes two passes of each path and shows the median.

- **Run 1** was on the build before two small fixes to pictures (scroll bars left out of SVG pictures, and the size of an iframe screen's picture). Neither fix touches the frame loop.
- **Run 2** is on the final build, and is the table below.

The raw JSON of both is in `bench/reference/packaged-0.1.0-run1.json` and `packaged-0.1.0-run2.json`.

A frame rate counts as within noise when it is within 2 frames a second or 10% of the spike's, whichever is larger.

**The engine matches the spike within noise in both runs.**

| Engine, frames per second | Spike | Run 1 | Run 2 |
|---|---|---|---|
| 100 screens, zoom sweep | 58.5 | 58.7 | 58.7 |
| 100 screens, pan zoomed out | 60.0 | 60.0 | 60.0 |
| 100 screens, pan at 50% | 60.0 | 60.0 | 60.0 |
| 100 screens, pan at 100% | 60.0 | 60.0 | 60.0 |
| 300 screens, zoom sweep | 59.3 | 58.2 | 57.5 |
| 300 screens, pan zoomed out | 60.0 | 60.0 | 60.0 |
| 300 screens, pan at 50% | 60.0 | 60.0 | 58.2 |
| 300 screens, pan at 100% | 60.0 | 60.0 | 60.0 |
| 1,000 screens, zoom sweep | 58.8 | 59.3 | 57.8 |
| 1,000 screens, pan zoomed out | 60.0 | 60.0 | 60.0 |
| 1,000 screens, pan at 50% | 60.0 | 60.0 | 59.2 |
| 1,000 screens, pan at 100% | 60.0 | 60.0 | 60.0 |

What differs, and how much:

- **Engine.** The largest difference from the spike is 1.1 frames a second in run 1 and 1.8 in run 2. Run 2 is lower than the spike on four of twelve rows and higher on one. No long tasks on any path in either run. The worst frame on a median pass was 50ms in both runs, as in the spike.
- **Run 2 was on a busier machine.** The baselines, whose code is unchanged, were slower in run 2 by up to 11.8 frames a second (naive at 100 screens, pan at 100%: 46.2 against 58.0). Eight of 24 baseline rows fall outside noise in run 2, all slower. In run 1 one did (today's approach, zoom sweep at 300 screens: 17.0 against 19.4). So the engine's small dip in run 2 is most likely the machine and not the build. That is an inference, not a measurement.
- **Size.** DOM elements and picture memory are identical to the spike at every count in both runs: 216, 616 and 2,016 elements, and 46.9, 80.3 and 101.4 MB of pictures. Browser memory is within 3 MB. The engine's heap at 1,000 screens is 4.2 MB against 4.9 MB.
- **Ready time.** 131, 120 and 159ms in run 1 and 95, 115 and 134ms in run 2, against 116, 111 and 147ms in the spike. One load each, so the spread between the two runs is larger than any difference from the spike.
- **Background.** Picturing every screen took 1.3s, 3.7s and 12.8s in run 1 and 1.5s, 3.6s and 14.5s in run 2, against 1.2s, 3.3s and 12.6s. Slower in both runs, by 2% to 15%. The target in the plan was under 15 seconds at 1,000 screens, and run 2 is close to it.

### Run 2: frames per second, packaged build against the spike

| Variant | Screens | Path | Packaged | Spike | Difference | Within noise |
|---|---|---|---|---|---|---|
| Engine | 100 | Zoom sweep | 58.7 fps, p95 16.8ms, 0 long | 58.5 fps, p95 16.8ms, 0 long | +0.2 | yes |
| Engine | 100 | Pan, zoomed out | 60.0 fps, p95 16.8ms, 0 long | 60.0 fps, p95 16.7ms, 0 long | +0.0 | yes |
| Engine | 100 | Pan at 50% | 60.0 fps, p95 16.7ms, 0 long | 60.0 fps, p95 16.7ms, 0 long | +0.0 | yes |
| Engine | 100 | Pan at 100% | 60.0 fps, p95 16.7ms, 0 long | 60.0 fps, p95 16.7ms, 0 long | +0.0 | yes |
| Today | 100 | Zoom sweep | 31.7 fps, p95 66.7ms, 24 long | 38.4 fps, p95 50.1ms, 11 long | -6.7 | NO |
| Today | 100 | Pan, zoomed out | 40.6 fps, p95 33.4ms, 0 long | 42.1 fps, p95 33.4ms, 1 long | -1.5 | yes |
| Today | 100 | Pan at 50% | 60.0 fps, p95 16.7ms, 0 long | 59.8 fps, p95 16.8ms, 0 long | +0.2 | yes |
| Today | 100 | Pan at 100% | 60.0 fps, p95 16.8ms, 0 long | 60.0 fps, p95 16.7ms, 0 long | +0.0 | yes |
| Naive | 100 | Zoom sweep | 18.8 fps, p95 83.4ms, 26 long | 19.3 fps, p95 83.4ms, 29 long | -0.5 | yes |
| Naive | 100 | Pan, zoomed out | 16.7 fps, p95 83.4ms, 28 long | 20.9 fps, p95 66.7ms, 3 long | -4.2 | NO |
| Naive | 100 | Pan at 50% | 45.3 fps, p95 33.4ms, 0 long | 52.8 fps, p95 33.3ms, 5 long | -7.5 | NO |
| Naive | 100 | Pan at 100% | 46.2 fps, p95 33.4ms, 0 long | 58.0 fps, p95 16.8ms, 0 long | -11.8 | NO |
| Engine | 300 | Zoom sweep | 57.5 fps, p95 16.8ms, 0 long | 59.3 fps, p95 16.8ms, 0 long | -1.8 | yes |
| Engine | 300 | Pan, zoomed out | 60.0 fps, p95 16.7ms, 0 long | 60.0 fps, p95 16.7ms, 0 long | +0.0 | yes |
| Engine | 300 | Pan at 50% | 58.2 fps, p95 16.8ms, 0 long | 60.0 fps, p95 16.7ms, 0 long | -1.8 | yes |
| Engine | 300 | Pan at 100% | 60.0 fps, p95 16.7ms, 0 long | 60.0 fps, p95 16.8ms, 0 long | +0.0 | yes |
| Today | 300 | Zoom sweep | 16.1 fps, p95 233.3ms, 29 long | 19.4 fps, p95 166.7ms, 33 long | -3.3 | NO |
| Today | 300 | Pan, zoomed out | 11.1 fps, p95 150.0ms, 43 long | 12.3 fps, p95 133.3ms, 40 long | -1.2 | yes |
| Today | 300 | Pan at 50% | 58.4 fps, p95 16.8ms, 0 long | 59.4 fps, p95 16.7ms, 0 long | -1.0 | yes |
| Today | 300 | Pan at 100% | 60.0 fps, p95 16.7ms, 0 long | 60.0 fps, p95 16.8ms, 0 long | +0.0 | yes |
| Naive | 300 | Zoom sweep | 5.8 fps, p95 216.8ms, 36 long | 6.5 fps, p95 216.7ms, 41 long | -0.7 | yes |
| Naive | 300 | Pan, zoomed out | 6.1 fps, p95 216.7ms, 25 long | 7.0 fps, p95 166.7ms, 29 long | -0.9 | yes |
| Naive | 300 | Pan at 50% | 11.1 fps, p95 116.8ms, 57 long | 12.0 fps, p95 116.7ms, 61 long | -0.9 | yes |
| Naive | 300 | Pan at 100% | 17.5 fps, p95 100.0ms, 52 long | 24.4 fps, p95 50.1ms, 7 long | -6.9 | NO |
| Engine | 1000 | Zoom sweep | 57.8 fps, p95 16.8ms, 0 long | 58.8 fps, p95 16.8ms, 0 long | -1.0 | yes |
| Engine | 1000 | Pan, zoomed out | 60.0 fps, p95 16.7ms, 0 long | 60.0 fps, p95 16.7ms, 0 long | +0.0 | yes |
| Engine | 1000 | Pan at 50% | 59.2 fps, p95 16.8ms, 0 long | 60.0 fps, p95 16.7ms, 0 long | -0.8 | yes |
| Engine | 1000 | Pan at 100% | 60.0 fps, p95 16.7ms, 0 long | 60.0 fps, p95 16.8ms, 0 long | +0.0 | yes |
| Today | 1000 | Zoom sweep | 4.0 fps, p95 716.7ms, 26 long | 5.3 fps, p95 599.9ms, 29 long | -1.3 | yes |
| Today | 1000 | Pan, zoomed out | 2.2 fps, p95 916.6ms, 10 long | 2.2 fps, p95 1033.4ms, 10 long | +0.0 | yes |
| Today | 1000 | Pan at 50% | 23.6 fps, p95 66.7ms, 20 long | 30.5 fps, p95 50.0ms, 4 long | -6.9 | NO |
| Today | 1000 | Pan at 100% | 50.8 fps, p95 33.4ms, 1 long | 60.0 fps, p95 16.7ms, 0 long | -9.2 | NO |
| Naive | 1000 | Zoom sweep | 1.4 fps, p95 1183.3ms, 10 long | 1.6 fps, p95 1033.3ms, 11 long | -0.2 | yes |
| Naive | 1000 | Pan, zoomed out | 1.0 fps, p95 1149.9ms, 6 long | 1.3 fps, p95 883.3ms, 7 long | -0.3 | yes |
| Naive | 1000 | Pan at 50% | 2.8 fps, p95 583.3ms, 16 long | 3.5 fps, p95 350.0ms, 19 long | -0.7 | yes |
| Naive | 1000 | Pan at 100% | 7.3 fps, p95 200.0ms, 38 long | 8.2 fps, p95 150.0ms, 43 long | -0.9 | yes |

### Run 2: load, background work and size

| Variant | Screens | Ready | Background | DOM elements | Heap | Browser memory | Picture memory |
|---|---|---|---|---|---|---|---|
| Engine | 100 | 95ms (spike 116ms) | 1.5s (spike 1.2s) | 216 (spike 216) | 3.3 MB (spike 3.3 MB) | 289 MB (spike 288 MB) | 46.9 MB (spike 46.9 MB) |
| Today | 100 | 713ms (spike 533ms) | 0.0s (spike 0.0s) | 15362 (spike 15362) | 7.1 MB (spike 7.4 MB) | 266 MB (spike 266 MB) | none |
| Naive | 100 | 631ms (spike 699ms) | 0.0s (spike 0.0s) | 15362 (spike 15362) | 7.1 MB (spike 7.2 MB) | 264 MB (spike 265 MB) | none |
| Engine | 300 | 115ms (spike 111ms) | 3.6s (spike 3.3s) | 616 (spike 616) | 3.7 MB (spike 3.8 MB) | 349 MB (spike 351 MB) | 80.3 MB (spike 80.3 MB) |
| Today | 300 | 1865ms (spike 1731ms) | 0.2s (spike 0.0s) | 45527 (spike 45527) | 15.8 MB (spike 15.7 MB) | 431 MB (spike 428 MB) | none |
| Naive | 300 | 1624ms (spike 1828ms) | 0.2s (spike 0.1s) | 45527 (spike 45527) | 15.8 MB (spike 15.8 MB) | 420 MB (spike 420 MB) | none |
| Engine | 1000 | 134ms (spike 147ms) | 14.5s (spike 12.6s) | 2016 (spike 2016) | 4.2 MB (spike 4.9 MB) | 425 MB (spike 422 MB) | 101.4 MB (spike 101.4 MB) |
| Today | 1000 | 7727ms (spike 6754ms) | 0.8s (spike 0.1s) | 150637 (spike 150637) | 47.6 MB (spike 47.6 MB) | 1003 MB (spike 1000 MB) | none |
| Naive | 1000 | 7087ms (spike 6086ms) | 0.6s (spike 1.1s) | 150637 (spike 150637) | 47.6 MB (spike 47.6 MB) | 953 MB (spike 958 MB) | none |

Ready is the time Playwright waited for the page to report it could be used, which includes starting the page. Background is the time to picture every screen.

**Verdict.** Every engine frame rate is within noise of the spike. 8 of the 24 baseline rows are not, all of them slower. See the notes above.

Measured 2026-11-15T15:56:28.233Z on headless Chromium with no real GPU. Reference measured 2026-11-15T06:51:46.985Z.
<!-- packaged:end -->

## Reproduce

```
pnpm install
pnpm bench
```

That builds both packages, builds the benchmark page against them, runs the engine and the two baselines at 100, 300 and 1,000 screens, and prints the comparison. It takes about fifteen minutes. The other measurements from the spike (cold start, the trace check, crispness, picture cost, far coordinates) are in `bench/scripts` and run with `pnpm --filter open-infinite-canvas-bench bench:all`.
