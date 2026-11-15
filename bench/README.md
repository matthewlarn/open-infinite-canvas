# Benchmarks

The benchmark page in `app/` shows the same screens three ways, and the scripts in `scripts/` drive each one along the same camera paths in headless Chromium.

- **engine** is `open-infinite-canvas`, loaded from the built packages.
- **today** is every screen mounted in one transformed parent, with `--z`, a fence and `content-visibility: auto`.
- **naive** is every screen mounted in one transformed parent and nothing else.

## Run it

From the repository root:

```
pnpm bench
```

That builds the packages and the page, runs every variant at 100, 300 and 1,000 screens, and prints a comparison with the reference run in `reference/bench.json`. It takes about fifteen minutes. `pnpm bench:quick` runs the engine alone in about four.

Results go to `results/`, which is not committed.

## The other scripts

| Script | What it measures |
|---|---|
| `scripts/run.cjs` | The main benchmark. Frame rate, long tasks, main thread time, memory, DOM size, layers. |
| `scripts/compare.cjs` | Puts a run beside the reference run |
| `scripts/cold.cjs` | The same paths started before any picture exists |
| `scripts/presented.cjs` | Frame counts checked against a browser trace |
| `scripts/crispness.cjs` | Text sharpness at nine zoom levels |
| `scripts/snapshot.cjs` | What one picture costs, and the HTML in Canvas probe |
| `scripts/precision.cjs` | Screens placed millions of pixels from the origin |
| `scripts/count.cjs` | Elements in each demo screen |
| `scripts/env.cjs` | The machine and the browser |
| `scripts/screenshots.cjs` | Pictures of the canvas in light and dark |
| `scripts/smoke.cjs` | A quick look at one variant |

`pnpm --filter open-infinite-canvas-bench bench:all` runs them all in order. Allow an hour.

## The checks

`tests/` holds Playwright tests that run on the same page: the 18 behaviour checks, the picture providers, iframe mode, reduced motion, React 18 and the plain DOM binding.

```
pnpm test:e2e
```

## Reading the numbers

The machine these were written on has no GPU. Chrome composites and rasters on the CPU, which is slow at moving large layers and so is hard on the two baselines. Treat the gap between the engine and the baselines as an upper bound until someone runs this on a real laptop. See `docs/results.md`.
