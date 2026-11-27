---
"@weasel-js/core": patch
---

Under an unbounded zoom clamp, `zoomAt`, `fitZoom`, `fitSize`, and `fitViewToBounds` hold a zoom past the double range at the largest double instead of dropping it to `ZOOM_FLOOR`.

<!-- entry: fix -->
