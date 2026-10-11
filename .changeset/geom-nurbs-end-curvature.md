---
'@weasel-js/geom': patch
---

`nurbs.curvatureAt` was wrong at t = 0 and t = 1: the finite-difference stencil clamped onto the end sample and lost its second derivative, so a curvature comb's first and last teeth did not match the curve. The stencil now sits one step inside the ends.
