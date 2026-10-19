---
"@weasel-js/geom": patch
---

Speed up the crossing check every nonzero fill runs before triangulating: it reads the flattened
coordinates without building an edge graph and sorts with a native numeric sort, which takes a
64-curve fill from 0.21 ms back to 0.18 ms. The turn bound a thick stroke's flattening applies
stops at the first control-polygon leg that exceeds it. Neither changes a mesh's vertices.
