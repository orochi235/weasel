---
'@weasel-js/geom': patch
---

`ellipseShape` from `start: 0` to `end: 360` is the whole ellipse, closed, as `arcShape` and `trackShapeD` take it, rather than a track of zero length or one just short of closed.

<!-- entry: fix -->
