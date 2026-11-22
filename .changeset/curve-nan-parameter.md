---
'@weasel-js/geom': patch
---

The cubic Bezier, quadratic Bezier, and Spiro curve representations answer NaN at a NaN parameter, as NURBS does, rather than throwing.

<!-- entry: fix -->
