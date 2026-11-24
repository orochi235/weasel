---
'@weasel-js/geom': patch
---

`flattenCubicWithArcLen` and `flattenQuadraticWithArcLen` measure arc length from the segment's own start, even when `out` already ends somewhere else.

<!-- entry: fix -->
