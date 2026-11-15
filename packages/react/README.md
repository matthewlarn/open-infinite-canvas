# @open-infinite-canvas/react

The React binding for `open-infinite-canvas`. It works with React 18 and React 19.

```tsx
import { InfiniteCanvas } from "@open-infinite-canvas/react"
import "open-infinite-canvas/styles.css"

<InfiniteCanvas label="Every screen" frames={frames} renderFrame={(frame) => <Screen id={frame.id} />} />
```

With React 19.2 or later a parked screen keeps its state and has its effects turned off, through `Activity`. With an older React a parked screen keeps its state and is hidden, and its effects go on running.

Hooks: `useInfiniteCanvas()` returns the engine. `useFrame()` tells a screen whether it is live, parked or staging.

MIT licence.
