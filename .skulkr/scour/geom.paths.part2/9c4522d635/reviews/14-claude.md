# Findings: geom.paths.part2

## reachToMeet in 'curvature' mode treats a rounding-level curvature as a full-turn arc of enormous radius
- where: packages/geom/src/paths/reachPath.ts:96 (reachToMeet)
- scenario: an open end whose last segment is a cubic with collinear handles (e.g. one `convertSegments` turned from a line into a curve, coords like 0.1/0.3) reads a curvature of ~1e-15 from `cubicCurvatureAt` instead of exactly 0. With no `maxDistance`, `reach` becomes `Infinity` because `frame.curvature !== 0`. `extensionPieces` then sees `|k|·Infinity > STRAIGHT_TURN` and builds `arcPieces` for a full circle of radius ~1e15. Each point is computed as `c.x + rx·cos − ry·sin` with the center ~1e15 away, so the extension starts up to ~0.1 unit off the end and runs as quarter-turn cubics ~1.5e15 long, which then go into `segmentCrossings` and `pieceLengthAt`. The crossing found, or missed, is not the one the near-straight tangent run would meet. With a finite `maxDistance` the same end grows straight (`|k|·reach` stays below `STRAIGHT_TURN`), so the two paths answer the same question differently. Expected: an end that bends less than `STRAIGHT_TURN` over the distance to the farthest stroke grows straight and searches to that distance.
- evidence: read
- severity: medium
- fix: packages/geom/src/paths/reachPath.ts
- size: line
- cause: Infinity reach bypasses STRAIGHT_TURN threshold
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

<!-- done: 1 findings, files read: 38 -->
