---
'@weasel-js/core': patch
---

`fitZoom`, `fitSize` and `useFitOnce` keep the fit inside the kit-wide zoom range (10% to 800%) unless given a `clamp`.

Tiny or huge content fits at 8x or 0.1x, so the next wheel or pinch zoom no longer jumps. Pass `{ min: 0, max: Infinity }` for the unclamped ratio.

<!-- entry: fix behavior -->
