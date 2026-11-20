---
'@weasel-js/scale': patch
---

A polar scale given an `axes` count of `NaN` or `Infinity` has one axis, as a count below 1 does, rather than placing every point at `NaN`.

<!-- entry: fix -->
