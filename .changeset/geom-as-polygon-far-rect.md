---
'@weasel-js/geom': patch
---

`asPolygonPath` keeps a rect far from 0 at its exact size, measuring its corners from an origin as the other path constructors do.

<!-- entry: fix -->
