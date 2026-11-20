---
'@weasel-js/core': patch
---

An animated zoom on a flipped (y-up) axis holds the point under its anchor still, as on an upright axis.

`interpolateView` keeps its linear path only for endpoints of different signs or a zero scale.

<!-- entry: fix -->
