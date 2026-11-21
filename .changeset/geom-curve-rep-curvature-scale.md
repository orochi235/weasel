---
'@weasel-js/geom': patch
---

The quadratic and NURBS curve representations answer a small curve's curvature instead of 0.

Every curve representation's `curvatureAt` now holds for curves of any size.

<!-- entry: fix -->
