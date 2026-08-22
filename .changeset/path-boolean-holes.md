---
'@weasel-js/core': patch
---

Path booleans keep holes, and Bezier flattening terminates on degenerate input

`pathToMultiPolygon` emitted every contour of a path as its own polygon.
`polygon-clipping` unions the polygons of a MultiPolygon, so a donut lost its
hole the moment it entered any boolean op — `pathUnion`, `pathIntersect`,
`pathSubtract`, `pathExclude`, `pathDivide` and `pathCrop` all returned a
filled disc. The path's `fillRule` was never read. Contours are now resolved
into outer + hole rings by nesting depth, honoring both `nonzero` and
`evenodd`, before the clipper sees them.

Results of a boolean op on a path with holes change shape, so this can move
pixels.

`flattenCubic`, `flattenQuadratic` and their arc-length variants recursed
forever on a non-finite control point and on a tolerance of `0`, `NaN`, or a
negative number — the flatness test can never be satisfied, so a stroke or a
hit-test on a path carrying a `NaN` coordinate blew the stack. Non-finite
input now emits the segment endpoint and stops; a non-positive tolerance is
floored at `1e-6`.
