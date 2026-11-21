# Audit round 65 — geom.paths.part2

## pathDistanceToPoint measures a negative-size RectPath as if the point were outside it
- where: packages/geom/src/paths/pathDistance.ts:20 (pointToRectPerimeterDistance)
- scenario: `{ kind: 'rect', x: 10, y: 0, width: -10, height: 10 }` — a real 10×10 square (pathToD writes it `M10 0h-10v10h10Z`) — and the point (2, 5) inside it: `dx = max(10 - 2, 2 - 0, 0) = 8`, so the "outside" branch returns 8, where the distance to the nearest edge (x = 0) is 2. Every branch assumes width and height ≥ 0; the rect should be normalized first.
- evidence: read
- severity: low

## mergeRegion with `tolerance: 0` drops every piece and returns an empty path
- where: packages/geom/src/paths/mergeRegion.ts:44 (mergeRegion), :320 (filledSide)
- scenario: `mergeRegion(twoOverlappingSquares, { tolerance: 0 })`. The tolerance goes in unclamped, so `probe = tol / SIDE_PROBE = 0` and `filledSide` reads `winding` at the same point for both `left` and `right`. They always match, so it returns `null` for every piece, every piece is dropped (`changed = true`, `pieces` stays empty), and the result has no commands: the shape is erased. A negative tolerance flips the probe's sign and reports every side the wrong way round. The function should clamp the tolerance to a positive floor, as `resamplePath` (`Math.max(tol, 1e-6)`) and `simplifyPath` (`fitParams`) do, or throw.
- evidence: read
- severity: medium

## Files read
packages/geom/src/paths/markers.ts
packages/geom/src/paths/mergeRegion.ts
packages/geom/src/paths/nearestAnchor.ts
packages/geom/src/paths/pathAt.ts
packages/geom/src/paths/pathAwayFromAnchors.ts
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

<!-- done: 2 findings, files read: 37 -->
