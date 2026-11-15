# Contributing

Thanks for looking. This project is small and young, so the rules are short.

## Set up

You need Node 20 or later and pnpm 10.

```
pnpm install
pnpm build
pnpm test
```

The Playwright checks and the benchmark use a Chromium that is already on the machine. They look in `PLAYWRIGHT_BROWSERS_PATH`. If you have none, run `pnpm --filter open-infinite-canvas-bench exec playwright install chromium` once.

## Where things are

```
packages/core     the engine. No framework, no runtime dependencies.
packages/react    the React binding
apps/demo         the demo, and a page that uses the engine with no framework
bench/app         the page the benchmark measures, with the baselines
bench/scripts     the benchmark scripts
bench/tests       Playwright checks
docs              architecture, results, accessibility
```

## Before you open a pull request

Run all of these. Each one must pass.

```
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm lint:prose
```

If your change touches the engine's frame loop, the scheduler, the far renderer or the picture providers, also run the benchmark and put the comparison table in the pull request.

```
pnpm bench
```

It takes about fifteen minutes. Close other programs first. The numbers move by a frame or two a second between runs on the same build, so do not read meaning into a difference that small.

## Rules of the code

- `packages/core` takes no runtime dependencies. If you need one, open an issue first.
- The camera never passes through a framework's render. Only a tier change may render.
- No DOM measurement in the frame loop. Positions come from numbers the engine already holds.
- Every exported name has a TSDoc comment that says what it does in plain words.
- Keep the public API small. Export a thing only when a consumer needs it.
- A new behaviour gets a test. Pure logic goes in `packages/core/test`. Anything that needs a browser goes in `bench/tests`.

## Rules of the numbers

- Report only what you measured. Say what machine and browser it was measured on.
- Never edit a number by hand. Change the code and run the script again.
- If a result gets worse, say so in the pull request.

## Rules of the writing

- Plain words and short sentences.
- No filler text in the demo. Every string should read as a real product would.
- Documentation is in American or British spelling, as long as one file is consistent.

## Accessibility

Every frame must stay reachable by keyboard and present in the accessibility tree, mounted or not. A change that breaks checks 12 to 16 in `bench/tests/behaviour.spec.ts` will not be merged. If you can test with VoiceOver, NVDA or JAWS, please do and tell us what you found. Nobody has yet.

## Licence

By contributing you agree that your work is released under the MIT licence.
