---
"@weasel-js/geom": patch
---

`resolveSnap` and the snap flats under it keep a direction whose squared length leaves the double range, such as `[1e-300, 0]` or `[1e200, 0]`. The flats are `orthonormalize`, `solveLeastSquares` and everything built on them; a line locus with such a direction no longer snaps as a point.

<!-- entry: rank=-5 fix -->
