---
'@weasel-js/geom': patch
---

`cubicBezierEasing` solves its curve to within 1e-7 where it flattens out near an end, as browsers do for `cubic-bezier()`, rather than to about 1e-4.

<!-- entry: fix -->
