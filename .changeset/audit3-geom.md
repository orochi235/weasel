---
'@weasel-js/geom': patch
---

Fix geometry edge cases found in a third audit pass:

- `pathFromD` draws an SVG arc whose radii are too large or too small to square in floating point (1e80, 1e-170), where it used to drop the arc.
- `intersectSegments` reports where two collinear lines overlap or touch end to end, as it already did for curves; `pathCrossings` and the snap and trim built on it see those touches.
- `cubicCurvatureAt` judges whether a cubic has lost its direction against the curve's own size, so a small curve no longer reads as straight.
- `schneiderFit` and `fitCubicWithTangents` scale their handle and Newton guards to the curve, so a small curve fits the same handles as a large one.
- `pathSignedArea` measures corner shapes as drawn, as bounds, hit tests and tessellation already did.
- `splitSubpaths` cuts where a drawing command after `Z` opens a subpath without an `M`, writing the `M` it implies, so `splitByClosure` no longer files the closed subpath before it as open.
- `@weasel-js/geom/3d`'s `normalize` keeps the direction of a vector whose squared length under- or overflows.
- `bendAlongPath` keeps a sharp corner of its spine sharp, rather than blending the heading across it. Shapes bent along a spine with corners change.
