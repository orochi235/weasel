---
'@weasel-js/geom': patch
---

`mat3.minScaleOf` keeps the smaller scale of a matrix that stretches far more one way than the other. It took the difference of two nearly equal squares, so a stretch of 1e4 by 1e-4 came back 22% off and one of 1e5 by 1e-5 came back 0. It now divides the determinant by the larger scale.
