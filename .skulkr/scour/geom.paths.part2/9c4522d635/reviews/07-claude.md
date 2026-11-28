## roundRectPath writes duplicate vertices (zero-length edges) whenever the radius reaches half a side
- where: packages/geom/src/paths/markers.ts:83 (roundRectPath)
- scenario: a pill, `roundRectPath(0, 0, 100, 20, 10)` (radius = height / 2, the usual pill-button call). Corner 1 ends at angle 0, at (100, 10); corner 2 starts at angle 0 from center (90, 10), also at (100, 10). The same thing happens on the left side, and on all four sides when width = height = 2r. The polygon gets back-to-back identical points: zero-length `L` segments with no direction. Stroke joins, tangent and normal readers, and anchor editing on the marker all see a degenerate segment. The point shared by two corners should be written once (skip the first sample of a corner when it coincides with the previous corner's last).
- evidence: read
- severity: low
- fix: packages/geom/src/paths/markers.ts
- size: function
- cause: corner arcs sampled inclusive at both ends with no check for a shared point
- confidence: sure

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

<!-- done: 1 findings, files read: 38 -->
