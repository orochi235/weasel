---
'@weasel-js/geom': patch
---

A path whose drawing commands follow a `Z` with no `M` between (`M0 0 L10 0 L10 10 z l-10 0 l0 -10 z`, legal SVG for two triangles) was read four different wrong ways: `pointInPath` missed the second shape, `extractPolylines` and `tessellate` joined it onto the first as one contour, and `pathToMultiPolygon` dropped it from every boolean op. All four now open a new subpath at the pen, as SVG does. `forEachSegment` tells its visitor when a command opens a subpath this way, and `extractPolylines` no longer throws on a path with no opening `M`.
