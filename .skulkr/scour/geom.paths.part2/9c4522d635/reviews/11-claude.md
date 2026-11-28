# Findings: geom.paths.part2

## tugPathEnd keeps the end anchor's dangling handle on a straight extension piece, curving the "straight" run
- where: packages/geom/src/paths/tugPathEnd.ts:205 (appendPieces)
- scenario: `tugPathEnd(set, { sub, end: 'first' }, 40, 'tangent')` on an `AnchorSet` whose first anchor carries an `inHandle` (a pen-drawn set where the first point was dragged, or a last anchor holding an `outHandle`). `atTail` reverses the subpath, so that `inHandle` becomes the tail anchor's `outHandle`. `growTail` only lengthens in place when the last segment is straight; otherwise `appendPieces` pushes the line piece and assigns handles only when `pts.length === 4`. The stale `outHandle` stays on `prev`, so `isStraightSegment(prev, next)` is false and the new segment is drawn as a cubic shaped by that handle. It should be a straight line along the tangent. On a cusp anchor whose dangling handle points off the tangent, the extension visibly bends. Any mode whose first piece is a line takes this path: `'tangent'` always, and `'curvature'` or `'eased'` on an end with no bend.
- evidence: read
- severity: low
- fix: packages/geom/src/paths/tugPathEnd.ts
- size: line
- cause: line piece leaves prev.outHandle untouched
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
