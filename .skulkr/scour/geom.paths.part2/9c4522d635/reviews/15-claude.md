# Findings: geom.paths.part2

## Curvature-mode reach and tug test straightness with `curvature === 0`, while the extension uses a turn threshold
- where: packages/geom/src/paths/reachPath.ts:92 (reachToMeet); packages/geom/src/paths/tugPathEnd.ts:96 (lengthToward)
- scenario: a curved end whose curvature is float noise rather than zero. One example: a segment turned into a curve by `convertSegments` (handles at the thirds, then stored as float32, so the cross product reads ~1e-12 instead of 0). With `mode: 'curvature'` and no `maxDistance`, `reachToMeet` sets `reach = Infinity` because `frame.curvature !== 0`. `extensionPieces(frame, Infinity, 'curvature')` then passes its own `|k|·distance > 1e-6` test and draws a full circle of radius ~1e12, in quarter-circle cubics whose chords are ~1e12 long. Crossings with a stroke 100 units ahead fall at t ≈ 1e-10 on such a piece, and the distance read from them (`pieceLengthAt` × a piece length of ~1.6e12) carries an absolute error far larger than the geometry. `lengthToward` takes the same branch and measures by angle about a center ~1e12 away, where `atan2` of the cancelling cross and dot products loses most of its digits. What should happen: the end is treated as straight, as `extensionPieces` itself would treat it for any finite distance, so reach is bounded by the strokes' extent and the length is a plain projection.
- evidence: read
- severity: low
- fix: packages/geom/src/paths/reachPath.ts, packages/geom/src/paths/tugPathEnd.ts, packages/geom/src/paths/pathEndExtension.ts
- size: function
- cause: straightness decided two ways (exact zero vs STRAIGHT_TURN)
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
