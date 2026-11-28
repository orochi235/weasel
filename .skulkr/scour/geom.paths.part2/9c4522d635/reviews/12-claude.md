# geom.paths.part2 — blind review findings

## roundRectPath writes duplicate vertices (zero-length edges) whenever the radius reaches half a side
- where: packages/geom/src/paths/markers.ts:67 (roundRectPath)
- scenario: `roundRectPath(0, 0, 40, 10, 5)` (a pill: r clamped to h/2). Corner 1 ends at (40, 5) and corner 2 starts at (40, 10 − 5) = (40, 5); corner 3 ends at (0, 5) and corner 0 starts at (0, 5), so the path holds an `L` to the point it is already at and a `Z` of zero length. A circle-shaped marker (w = h = 2r) gets four such pairs. Each corner's last sample should be skipped when it coincides with the next corner's first (or the straight run between them omitted when it has no length).
- evidence: read
- severity: low
- fix: packages/geom/src/paths/markers.ts
- size: function
- cause: corner arcs always emit both endpoints even when straight runs between them are empty
- confidence: sure

## mergeRegion runs quadratically in segment count (overlapCuts pairs, filledSide winding per piece)
- where: packages/geom/src/paths/mergeRegion.ts:92 (overlapCuts), :325 (filledSide → winding)
- scenario: a flattened outline of 20,000 straight edges (a traced bitmap, a densely sampled freehand fill) runs `endsAlong` on every pair of line segments (~2·10^8 calls, each allocating arrays), then `winding` walks every ring point twice for every piece. The call blocks for many seconds where a bounding-box prefilter (as `crossingsAmong` presumably has) would make it near-linear.
- evidence: read
- severity: low
- fix: packages/geom/src/paths/mergeRegion.ts
- size: function
- cause: no spatial prefilter on pairwise overlap test or winding probe
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
