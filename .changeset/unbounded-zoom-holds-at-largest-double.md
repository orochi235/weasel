---
"@weasel-js/core": patch
---

A zoom past the double range under an unbounded clamp stays zoomed in at the largest double. `zoomAt`, `fitZoom`, `fitSize`, and `fitViewToBounds` had dropped it to `ZOOM_FLOOR`.

<!-- entry: fix -->
