---
"@weasel-js/geom": patch
---

The snap flats (`orthonormalize`, `solveLeastSquares`, and everything built on them, `resolveSnap` included) keep a direction whose length squares out of the double range, such as `[1e-300, 0]` or `[1e200, 0]`. One that small was taken for a zero direction and dropped, and one that large too, so a line locus snapped as a point.
