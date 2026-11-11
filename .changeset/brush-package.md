---
'@weasel-js/brush': patch
---

New package `@weasel-js/brush` lets several brush tools share one brush size. `shareBrushSize(options)` keeps a brush's size option under the `BRUSH_SIZE_PX` key; hand it to each brush tool's `share` option and they share one size, held to each tool's own bounds. A brush not given it keeps its own size.

`linkBrushSize`, `SHARED_BRUSH_SLOT` and `SHARED_BRUSH_SIZE` are gone: pass `shareBrushSize(options)` as each tool's `share` instead.

<!-- entry: rank=10 breaking new api -->
