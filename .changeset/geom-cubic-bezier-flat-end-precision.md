---
'@weasel-js/geom': patch
---

`cubicBezierEasing` solves a curve to within 1e-7 where it flattens near an end, as browsers do, rather than to about 1e-4.

<!-- entry: fix -->
