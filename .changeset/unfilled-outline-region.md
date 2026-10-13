---
'@weasel-js/core': patch
'@weasel-js/geom': patch
---

Fixes: a marquee or lasso in `intersect` mode drawn wholly inside a closed shape with no fill selected it, though a click there did not. A region now takes an unfilled shape only where it meets the outline or encloses it. This changes what a marquee selects: one drawn inside a stroke-only rect to reach the nodes within it no longer takes the rect too.

Adds API: `polygonIntersectsPath(polygon, path, { filled: false })` in `@weasel-js/geom` reads a closed subpath as a line, and `regionTakes` takes a sixth argument, `filled`, a thunk asked only when the bounds cannot decide. Both default to filled.
