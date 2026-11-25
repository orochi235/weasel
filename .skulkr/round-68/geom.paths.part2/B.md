# Audit round 68 — geom.paths.part2 findings

## Marker builders write absolute float32 coords with no origin, so a marker far from 0 loses its shape
- where: packages/geom/src/paths/markers.ts:19 (circlePath), :37 (squarePath), :50 (rectMarkerPath), :65 (roundRectPath)
- scenario: `circlePath(300_000, 0, 2)` stores `cx + r·cos θ` straight into a `Float32Array` with no `origin`. At 300,000 a float32 step is 1/32, so a radius-2 circle's 32 vertices snap onto a 1/32 grid (64 steps across the whole circle). The facets come out uneven and `r` is off by up to 1/64. Every other producer in the package (`PathBuilder.autoOrigin`, `transformPath`, `translatePath`, `polygonPathFrom`) picks an origin past `ORIGIN_THRESHOLD` (2^14) for exactly this reason. These four return paths that are already rounded before any reader sees them. They should build through `PathBuilder().autoOrigin()` or `polygonPathFrom`.
- evidence: read (markers.ts:22-33, :41-46, :54, :89-102 write `Float32Array` coords directly; pathOrigin.ts:67-91 documents the threshold and the precision it protects)
- severity: medium

## reachToMeet with an explicit `maxDistance: Infinity` in tangent or eased mode meets nothing
- where: packages/geom/src/paths/reachPath.ts:86 (reachToMeet)
- scenario: a caller passes `{ maxDistance: Infinity }` to mean "unbounded". `reach` is then Infinity, and `extensionPieces(frame, Infinity, 'tangent')` returns `line(point, dir, Infinity)`, a segment ending at ±Infinity (pathEndExtension.ts:74, :89-91). Eased mode gets the same straight run of `Infinity - ease` (pathEndExtension.ts:155-158). Crossing math on an infinite endpoint produces Infinity/NaN parameters, so no hit is found and the function returns null even when a boundary sits straight ahead. The default path sets `reach = Infinity` only for curvature mode, where `arcPieces` caps the sweep at one full turn. Tangent and eased modes have no such cap and no guard against an infinite `maxDistance`.
- evidence: read (the null result is inferred from the infinite piece endpoints; I did not trace `segmentCrossings` itself)
- severity: low

## pathSignedArea returns a negative area for a RectPath with negative extent, contradicting "counts as positive"
- where: packages/geom/src/paths/winding.ts:36 (pathSignedArea)
- scenario: `pathSignedArea({ kind: 'rect', x: 10, y: 0, width: -10, height: 5 })` returns -50. The doc says "A `RectPath` has no direction and counts as positive". Negative-extent rects do reach these readers: `pathDistanceToPoint` normalizes them explicitly (pathDistance.ts:42). A caller that relies on the documented sign, for example to tell a hole from a solid, or that uses the value as an area, misreads such a rect. Either `Math.abs(width * height)` or a doc that states the sign follows the extents (which matches how `pathToCubicContours` walks the rect) would settle it.
- evidence: read
- severity: low

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

<!-- done: 3 findings, files read: 37 -->
