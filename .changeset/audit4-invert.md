---
'@weasel-js/geom': patch
---

geom's 2D `invert` and `@weasel-js/geom/3d`'s `invert` refuse the same matrices: one too ill-conditioned to invert meaningfully, its condition number (the 1-norm of the matrix times that of its inverse) at or past 1e12, judged on the linear part, so translation never counts. A new `invertible(norm, inverseNorm)` in geom holds the rule. The 3D `invert` used to accept a matrix as uneven as `scale(1e6, 1e-7, 1)` and a projection with a 1e-12 near plane, and now refuses both; every camera kernel3d builds still inverts.
