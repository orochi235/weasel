# Findings: geom.paths.part2

## roundRectPath emits zero-length segments whenever the radius reaches half the shorter side (pills, circles)
- where: packages/geom/src/paths/markers.ts:72 (roundRectPath)
- scenario: `roundRectPath(0, 0, 40, 10, 5)` (a pill, r = h/2, the common case of a clamped radius). Top-right corner's last sample is `(40, 5)` and bottom-right's first sample is `(40, 10 - 5) = (40, 5)`: two identical consecutive vertices, so the polygon gets a zero-length `L`. The same happens on the left (bottom-left ends at `(0, 5)`, which is the `M` point, then `Z`), and for `width === height === 2r` at all four joins. Every corner always emits both of its arc end points, with no check for the next corner starting there. Stroked markers then have zero-length segments with no direction, which joins/tangent readers (miter joins, `measurePath` headings) have to special-case; should skip a corner's first sample when it equals the previous corner's last.
- evidence: read
- severity: low
- size: function
- cause: corner end samples are not deduplicated when straight edges collapse to zero length
- confidence: sure

## tweenPaths drops a contour that has no segments on one side, so `at(1)` is not the second shape
- where: packages/geom/src/paths/tweenPaths.ts:139 (subdivideTo), :218 (lerpContour)
- scenario: `a` holds a bare `M` subpath (a lone pen point), which `pathToCubicContours` gives as a contour with no segments, while `b`'s matching contour has k segments. `collapsed()` only runs when the contour is missing altogether (`ca[i] ?? …`), not when it is empty, so `matchContours` calls `subdivideTo([], k)`, which returns `[]` (`segs.length === 0` early return). `lerpContour` maps over `a.segs`, so the result has no segments for every `t`, including `t = 1`, contradicting "exactly the second at 1". Expected: an empty contour is treated like a missing one (grown from a point via `collapsed`).
- evidence: read
- severity: low
- fix: packages/geom/src/paths/tweenPaths.ts
- size: line
- cause: empty contour not routed to `collapsed`
- confidence: likely

## simplifyPath leaves a duplicate seam anchor on a closed subpath when its last corner-to-corner run collapses to one point
- where: packages/geom/src/paths/simplifyPath.ts:121 (fitStops)
- scenario: a closed subpath with corners where the final run (last corner back to `corners[0] + n`) has coincident anchors, e.g. the last anchor duplicated on the first. `sampleRun` dedupes it to one point, the loop `continue`s, so no run is ever fitted with `last = true`; the run before it was fitted with `last = false` and pushed its end anchor, which sits on `out[0]`. The closed result then carries two anchors at one point (a zero-length closing segment) instead of closing on `out[0]`.
- evidence: read
- severity: low
- size: function
- cause: `last` keyed on the run's position, not on the last run actually fitted
- confidence: likely

## Files read
packages/geom/src/paths/markers.ts
packages/geom/src/paths/mergeRegion.ts
packages/geom/src/paths/nearestAnchor.ts
packages/geom/src/paths/pathAt.ts
packages/geom/src/paths/pathAwayFromAnchors.ts
packages/geom/src/paths/pathData.ts
packages/geom/src/paths/pathDistance.ts
packages/geom/src/paths/pathEndExtension.ts
packages/geom/src/paths/pathFromD.ts
packages/geom/src/paths/pathInWorld.ts
packages/geom/src/paths/pathMeasure.ts
packages/geom/src/paths/pathOrigin.ts
packages/geom/src/paths/pathStructure.ts
packages/geom/src/paths/pathToD.ts
packages/geom/src/paths/poiseHandles.ts
packages/geom/src/paths/puckerBloatPath.ts
packages/geom/src/paths/reachPath.ts
packages/geom/src/paths/repeatAlongPath.ts
packages/geom/src/paths/resamplePath.ts
packages/geom/src/paths/roughenPath.ts
packages/geom/src/paths/samePolygon.ts
packages/geom/src/paths/schneiderFit.ts
packages/geom/src/paths/segmentLength.ts
packages/geom/src/paths/segmentType.ts
packages/geom/src/paths/simplifyAnchors.ts
packages/geom/src/paths/simplifyPath.ts
packages/geom/src/paths/snipPath.ts
packages/geom/src/paths/spanFit.ts
packages/geom/src/paths/spiro.ts
packages/geom/src/paths/spiroPath.ts
packages/geom/src/paths/splitByClosure.ts
packages/geom/src/paths/splitSubpaths.ts
packages/geom/src/paths/transform.ts
packages/geom/src/paths/transformPath.ts
packages/geom/src/paths/tugPathEnd.ts
packages/geom/src/paths/tweenPaths.ts
packages/geom/src/paths/winding.ts
packages/geom/src/paths/zigzagPath.ts

<!-- done: 3 findings, files read: 38 -->
