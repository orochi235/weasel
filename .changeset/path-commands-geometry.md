---
'@weasel-js/geom': patch
'@weasel-js/stroke': patch
---

Geometry for the path commands. `simplifyPath(path, tolerance)` refits a path with as few anchors as hold it within the tolerance, keeping corners, the ends of open subpaths, and long flats between curves. `snipPathsAtCrossings(paths)` (in `@weasel-js/geom/booleans`) cuts each path's stroke wherever another of them crosses it. `averageAnchorsAt` moves anchors to their mean position on one or both axes, and `joinAnchorsAt` / `joinSubpathEnds` join two open-subpath ends, closing a subpath or merging two, with `subpathEndAt` and `closestOpenEnds` to find them. In `@weasel-js/stroke`, `offsetPath(path, distance)` grows or shrinks the region a path fills, taking a stroke's miter, round, or bevel joins, and refits the result as curves.
