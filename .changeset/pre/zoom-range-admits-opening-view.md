---
'@weasel-js/labkit': patch
---

Never clamp a canvas's opening zoom out of reach

An instrument declaring `initialView.zoom` far outside `usePanZoom`'s default
`[0.1, 32]` range collapsed on the first wheel event and could not zoom back:
the clamp rewrote the opening zoom to whichever bound it crossed, and pan was
rescaled by the same ratio, so the canvas appeared to go blank on one twitch.

`usePanZoom` now widens its effective range to always admit the zoom the
canvas opened at, for the life of that canvas — an explicit `maxZoom` below
the opening zoom no longer wins. `CanvasStack` and `CanvasCapability` (an
instrument's `canvas` config) both gain optional `minZoom` / `maxZoom` props
so an instrument can also widen the range up front instead of relying on the
invariant to save it.
