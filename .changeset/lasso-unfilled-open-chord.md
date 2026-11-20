---
'@weasel-js/geom': patch
---

A lasso no longer selects an unfilled open path by crossing only the gap between its ends: `polygonIntersectsPath` with `filled: false` tests an open subpath's drawn line alone.

<!-- entry: fix -->
