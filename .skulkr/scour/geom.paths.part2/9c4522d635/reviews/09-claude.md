# Findings: geom.paths.part2

## pathToD writes data with no leading moveto for a polygon whose first command is not `M`
- where: packages/geom/src/paths/pathToD.ts:27 (pathToD)
- scenario: `forEachSegment` (commands.ts:61-64) treats a drawing command with no `M` before it as opening a subpath at the pen, so `{commands: [L, L, Z], coords: [10,0, 10,10]}` is a valid triangle from (0,0), or from `origin` when the path has one. `pathToD` emits `L10 0L10 10Z`. SVG renders nothing for data that does not start with a moveto, and `pathFromD` returns an empty path for it (`strayPathDataHead` / the `!started` check). Export and round-trip both lose the shape. `pathToD` should emit `M<origin.x> <origin.y>` (the pen in world space) before a first command that opens a subpath.
- evidence: read
- severity: low
- size: line
- cause: implicit subpath start not written out
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
