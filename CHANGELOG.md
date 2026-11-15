# Changelog

All notable changes to this project are written here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [0.1.0] - 2026-11-15

The first packaged version. It turns a research spike into two packages, a demo and a benchmark. It has not been published to npm.

### Added

- `open-infinite-canvas`, the engine, with no framework and no runtime dependencies.
  - A camera with zoom to cursor, wheel pan, trackpad pinch, drag to pan with a glide, and fit to a rectangle.
  - A grid index over frame rectangles.
  - A level of detail scheduler with four tiers: live, parked, picture and placeholder. The defaults are 24 live and 24 parked, and both are settings.
  - A far layer that draws every picture on one canvas and lets the compositor move it between drawings.
  - Picture providers: HTML in Canvas, SVG and build-time screenshots. The default provider falls back from HTML in Canvas to SVG.
  - Keyboard travel between screens, focus in and out of a live screen, a list of every screen for screen readers, and announcements.
  - Reduced motion, followed from the system setting unless told otherwise.
  - A floating DOM origin, so a world millions of pixels wide still lays out exactly.
  - `mountCanvas`, a complete canvas in plain DOM.
  - `layoutRows`, a pure layout function.
- `@open-infinite-canvas/react`, the React binding, for React 18 and 19. It uses `Activity` where React has it and hides parked screens with CSS where it does not.
- Iframe mode for a single screen, through `src` on a frame.
- A demo with 300 screens.
- Playwright benchmarks, baselines and behaviour checks, and unit tests for the camera, the grid index, the scheduler and the layout helpers.

### Changed from the spike

- The scheduler is its own class with no DOM in it, so it can be tested alone.
- The keyboard list is built by the engine in plain DOM. In the spike React rendered it.
- The keyboard list now comes before the screens in the document, so Tab reaches it first.
- A picture provider is given the frame as well as the element.
- A failed picture is reported through `onPictureError`. The spike dropped the error.
- The engine follows the reduced motion setting by itself. In the spike only the React binding read it.
- SVG pictures leave scroll bars out. In the spike a picture showed scroll bars that the live screen did not.
- The grid index, the camera maths, the far renderer and the frame loop are unchanged.

### Known gaps

- Measured only on headless Chromium with no real GPU. Safari and Firefox have not been run.
- Not tested with a screen reader, on touch devices or on a display with a device pixel ratio of 2.
- Frames cannot be moved or resized. There is no marquee selection and no anchor layer.
