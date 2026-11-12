---
'@weasel-js/core': minor
---

`clientToWorld`'s origin and `forEachCoalesced`'s `canvasRect` take an optional `scale`, for a canvas an ancestor transform scales.

`dragPointOf` reads the scale off its element. Pass `layoutBoxOf(canvas)` as an origin to carry it; `layoutBoxOf`, `clientScaleOf` and `canvasToClient` are re-exported from routing.

<!-- entry: api -->
