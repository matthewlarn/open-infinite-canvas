# open-infinite-canvas

The engine for an infinite canvas that holds hundreds of live screens. No framework and no runtime dependencies.

```ts
import { createCanvas, mountCanvas, layoutRows } from "open-infinite-canvas"
import "open-infinite-canvas/styles.css"
```

- `mountCanvas(container, options)` builds a complete canvas in plain DOM.
- `createCanvas(options)` makes the engine alone, for a view layer of your own.
- `connectCanvas(engine, parts, options)` adds input, keyboard travel and announcements to that view layer.

The full guide is in the repository README and in `docs/architecture.md`. For React, use `@open-infinite-canvas/react`.

MIT licence.
