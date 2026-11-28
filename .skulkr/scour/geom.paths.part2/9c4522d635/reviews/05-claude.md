# Findings: geom.paths.part2

## pathToD writes invalid SVG data for a path whose first command is a drawing command
- where: packages/geom/src/paths/pathToD.ts:27 (pathToD)
- scenario: `forEachSegment` (commands.ts:61-64) treats a drawing command that no `M` precedes as opening a subpath at the pen (0, 0 in coord space, i.e. the origin). A polygon with commands `[L, L, L, Z]` is therefore a valid triangle with a vertex at the origin, and every geom reader draws it that way. `pathToD` emits one SVG command per kit command, so it writes `L10 0L10 10L0 10Z` with no leading moveto. SVG rejects data that does not start with `M`, and `pathFromD` builds an empty path from it (pathFromD.ts:50-53), so the round trip loses the whole shape. It should write the implied `M<pen>` first, the way `splitSubpaths` already handles a subpath opened after a `Z`.
- evidence: read
- severity: low
- fix: packages/geom/src/paths/pathToD.ts
- size: function
- cause: implicit subpath opening ignored at path start
- confidence: sure

## splitSubpaths leaves out the implied `M` when the path's first subpath opens without one
- where: packages/geom/src/paths/splitSubpaths.ts:46 (placeSubpaths)
- scenario: The doc promises that every drawing command that opens a subpath without an `M` "gets the `M` it implies". `pen` is only set when a boundary is crossed with `i > cmdStart`. At `i === 0` the condition is false, so for commands `[L, L, Z, M, L, Z]` the first returned subpath is `[L, L, Z]` with no `M` and its `sources` has no -1 entry. Drawn alone that is fine, but a consumer that reorders or joins the parts (for example `joinPaths(splitSubpaths(p).reverse())`, or `splitByClosure` when that subpath ends up after another in its group) draws it from the previous subpath's pen, not from (0, 0).
- evidence: read
- severity: low
- fix: packages/geom/src/paths/splitSubpaths.ts
- size: line
- cause: `i > cmdStart` guard skips index 0
- confidence: sure

## reachToMeet and extensionPieces disagree on when a 'curvature' end is straight, so a near-straight end with no maxDistance becomes a vast full circle
- where: packages/geom/src/paths/reachPath.ts:96 (reachToMeet)
- scenario: With no `maxDistance` in 'curvature' mode, `reachToMeet` sets `reach = Infinity` whenever `frame.curvature !== 0`. `extensionPieces` decides "bends" by `|κ|·distance > STRAIGHT_TURN` (pathEndExtension.ts:71), and with an infinite distance that test passes for any nonzero κ. A curved end that is straight up to float32 noise (say a segment `convertSegments` turned into a curve with handles at thirds, then stored as float32, giving κ ≈ 1e-12) gets four quarter-circle cubics of radius ~1e12. The crossing with a boundary 100 units ahead then sits at `ta` ≈ 1e-10 on a cubic whose control points are 1e12 away, where `segmentCrossings` and `pieceLengthAt` lose precision or miss the hit. The same end with any finite `maxDistance` is grown as a straight line. The straightness decision should be one test, the `STRAIGHT_TURN` one, used in both places.
- evidence: read
- severity: low
- fix: packages/geom/src/paths/reachPath.ts, packages/geom/src/paths/pathEndExtension.ts
- size: line
- cause: two straightness tests (`!== 0` vs `STRAIGHT_TURN`)
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
