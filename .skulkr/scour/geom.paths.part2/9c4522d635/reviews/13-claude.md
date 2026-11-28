## roundRectPath writes duplicate vertices wherever a side collapses (pill shapes, circles)
- where: packages/geom/src/paths/markers.ts:84 (roundRectPath)
- scenario: `roundRectPath(0, 0, 100, 20, 10)` (radius clamped to half the short side, the usual pill) — the top-right corner's last sample is (100, 10) and the bottom-right corner's first sample is also (100, 10), and likewise on the left; a square with r = size/2 duplicates at all four joins. Each duplicate becomes a zero-length `L`. A stroker or anything reading per-edge headings meets a zero-length edge with no direction, and the marker's vertex count is inflated. Each corner after the first should skip its first sample when the straight side before it has no length.
- evidence: read
- severity: low
- fix: packages/geom/src/paths/markers.ts
- size: function
- cause: corner joins emit both ends even when the side between them is empty
- confidence: sure

## pathInWorld can return the input instance despite promising a fresh Path
- where: packages/geom/src/paths/pathInWorld.ts:63 (pathInWorld)
- scenario: when the path's AABB already equals the pose box and the pose has no rotation or transform, `pathInPoseBox` returns `path` itself and `pathInWorld` returns `local` unchanged, so `pathInWorld(p, pose) === p`. The docstring says "Returns a fresh `Path` instance; never mutates inputs", so a caller that trusts it and edits the result in place (for example, writing into `coords`) mutates the stored path.
- evidence: read
- severity: low
- fix: packages/geom/src/paths/pathInWorld.ts
- size: line
- cause: docstring contradicts the identity shortcut
- confidence: sure

## reachToMeet never lets an end meet its own last segment
- where: packages/geom/src/paths/reachPath.ts:44 (segmentsBesideEnd)
- scenario: take a one-segment open C-shaped cubic and call reachToMeet with mode 'curvature' or 'eased'. The arc curls round and crosses the cubic itself, but `segmentsBesideEnd` drops the end's whole segment from the search, so the call returns null (or meets something further on). The drop isn't needed to avoid the start contact, because `d > touching` already skips a hit at distance ≈ 0. Fix: keep the segment and rely on `touching`.
- evidence: read
- severity: low
- fix: packages/geom/src/paths/reachPath.ts
- size: function
- cause: the end's own segment is excluded wholesale rather than only its contact at the start
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
