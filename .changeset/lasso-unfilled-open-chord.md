---
'@weasel-js/geom': patch
---

A lasso crossing only the gap between an unfilled open path's ends no longer selects it. `polygonIntersectsPath` with `filled: false` tests an open subpath's drawn line alone.

<!-- entry: fix -->
