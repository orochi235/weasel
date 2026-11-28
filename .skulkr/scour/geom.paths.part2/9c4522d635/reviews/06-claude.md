## pathToD writes path data SVG rejects for a polygon whose first command is not `M`
- where: packages/geom/src/paths/pathToD.ts:28 (pathToD)
- scenario: a `PolygonPath` whose commands start with `L`/`C`/`Q` and have no `M` before them. `forEachSegment` says such a command opens a subpath at the pen, which starts at coords (0, 0), so the kit draws from there, or from `origin` when the path has one. `pathToD` writes `L…` as the first command, and SVG renders nothing for data that does not begin with a moveto (`pathFromD` itself rejects it). The SVG export and the round trip lose the whole path. It should write `M<pen>` first, in world coords (the origin when there is one), whenever a drawing command opens a subpath.
- evidence: read (commands.ts:61-64 for the implicit-open rule; pathFromD.ts and pathData.ts strayPathDataHead for the rejection)
- severity: low
- size: function
- cause: walks commands without honoring forEachSegment's implicit subpath start
- confidence: likely

## zigzagPath leaves the leading points unpushed when a contour starts on a zero-length segment
- where: packages/geom/src/paths/zigzagPath.ts:36 (zigzagPath)
- scenario: a contour whose first segment has no length, e.g. `M0 0 L0 0 L10 0 L10 10 Z` (a doubled anchor, which happens when a pen click lands twice). Each sample on that segment has `dir === null`, and `normal` starts as `{0, 0}`, so the first `pieces` points get no offset and sit on the outline, breaking the alternation the docs promise. The comment says such a point "keeps the one before's normal", but the first points have no point before them. Those leading points should take the first non-null normal in the contour.
- evidence: read (contourSamples.ts sampleAt: dir is null on a segment of no length)
- severity: low
- size: line
- cause: normal seeded with zero instead of the first defined direction
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

<!-- done: 2 findings, files read: 38 -->
