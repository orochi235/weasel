---
'@weasel-js/geom': patch
---

`ellipseShape` from `start: 0` to `end: 360` is the whole ellipse, closed. It is whole as `arcShape` and `trackShapeD` take it.

<!-- entry: fix -->
