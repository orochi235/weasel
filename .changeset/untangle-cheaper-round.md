---
'@weasel-js/geom': patch
---

A puppet warp that folds solves faster, with the same result. Each round of the injective pass reads the
Jacobians inline, solves both coordinates against the edge system in one pass over its factor, and finds
the nearest flattening without allocating per triangle.
