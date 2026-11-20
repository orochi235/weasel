I couldn't write `.skulk/out/findings.md`: after the first write, every later write to it was denied permission. The copy on disk is stale and holds only the first two findings. As the brief allows, here is the whole document:

# Audit round 49 — geom.paths.part2 (blind reviewer)

Note: the brief's frozen commit 2f3b11a is not in this clone. `packages/geom/src/paths` has no changes from HEAD d057251, so that is the code I read.

## joinPaths measures every part from the first part's origin, so a far part joined after a near one loses its precision
- where: packages/geom/src/paths/pathOrigin.ts:82 (joinPaths)
- scenario: parts = [a path near 0 with no origin, a path at x≈1e6 measured from its own origin]. `origin` comes from `parts[0]`, which is undefined. The second part is then re-measured from (0,0) into float32 coords at 1e6, on a 1/16 grid. That is the precision loss `origin` exists to prevent. Real callers reach this case:
  - `core/src/core/scene/derivedParts.ts:70`: a blend or repeat whose first part sits near 0 and later parts sit far out.
  - `textToPath` and `textClusters`, when they join mixed parts.
  
  The origin should be chosen to cover every part, for example `originFor` over the joined world coords.
- evidence: read
- severity: medium

## joinPaths drops every part's `corners` and `openFill`
- where: packages/geom/src/paths/pathOrigin.ts:93 (joinPaths)
- scenario: join two polygon paths where one carries `corners`. The result has no `corners`, so the joined path is drawn, hit-tested and bounded with bare sharp anchors. `derivedParts.ts:70` joins scene parts this way, so a repeated or blended shape with rounded corners loses them. The specs could be concatenated by anchor offset with `carryCorners`, as `splitByClosure` does. `openFill` is dropped the same way, so an open part set to `'none'` gets the engine default fill instead.
- evidence: read
- severity: medium

## translatePath leaves a far-moved origin-free polygon in raw float32, where transformPath gives it an origin
- where: packages/geom/src/paths/transform.ts:29-41 (translatePolygonCopy)
- scenario: an origin-free polygon near 0 is translated by (1e6, 0). A drag does this through `pathPoseDescriptor.ts:39` or `originProjection.ts:34`. `translatePath` writes `coords + dx` straight into a `Float32Array`, so the coordinates snap to a 1/16 grid. On the same input, `transformPath(path, translate(1e6, 0))` picks an origin with `originFor` (transformPath.ts:63) and keeps full precision. One move gets two different answers.
- evidence: read
- severity: medium

## reachToMeet in `'curvature'` mode on a straight end, with no `maxDistance`, grows an infinitely long line and finds nothing
- where: packages/geom/src/paths/reachPath.ts:93, with pathEndExtension.ts:71-74
- scenario: a straight end has curvature exactly 0 (tugPathEnd.ts:144). Call `reachToMeet(path, [wall], end, { mode: 'curvature' })` with a wall directly ahead.
  1. `reach` becomes `Infinity`.
  2. `|0|·Infinity` is NaN, so `bends` is false.
  3. The extension becomes `line(point, tangent, Infinity)`, whose far end is NaN or ±Infinity.
  4. `segmentCrossings` can't intersect that line, and even a hit would read `pieceLengthAt = Infinity·t`.
  
  The result is null, while `'tangent'` and `'eased'` modes find the wall.
- evidence: read
- severity: medium

## splitByClosure misnumbers corner sources after a subpath opened without an `M`
- where: packages/geom/src/paths/splitByClosure.ts:30-33, 52
- scenario: a path with corners, plus a subpath that a drawing command opens after a `Z` (`… Z L20 20 L30 0 Z M50 50 …`).
  - `splitSubpaths` gives that subpath an explicit `M` (splitSubpaths.ts:29-33), and `countPathAnchors(sub)` counts it.
  - The path's own flat numbering does not count that implicit start (anchors.ts:51-53).
  - So that subpath's `count` is one too high. `anchorRange(first, count)` shifts its corner sources by one slot, and `first` drifts by one for every later subpath.
  
  Corner specs land on the wrong anchors.
- evidence: read
- severity: medium

## simplifyAnchorsAt leaves a closed subpath rotated to a new start anchor
- where: packages/geom/src/paths/simplifyAnchors.ts:37-56
- scenario: a closed subpath with 6 anchors, `flatIndexes` = {0,1,2,3}.
  - The subpath is reordered to start at anchor 4 (`shift` = 4), giving `order` = [4,5,0,1,2,3].
  - The thinned `out` is stored still in that order, so the subpath now starts at old anchor 4.
  
  This moves the dash phase, the text-on-path start and the `setSubpathStart` seam. It also shifts every flat index the caller remaps for a selection.
- evidence: read
- severity: low

## mergeRegion reads its winding from a fill-dependent area while treating every subpath as closed
- where: packages/geom/src/paths/mergeRegion.ts:49
- scenario: open, counter-clockwise subpaths with `openFill: 'none'`.
  - `closeContour` treats every subpath as closed.
  - But `pathSignedArea` counts those open subpaths as 0 (winding.ts:39), so `fillLeft` is false whatever the winding.
  - So every piece is reversed and `changed` is forced true.
  
  The result is wound against the input instead of returning the input's contours unchanged, as the docs promise.
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

<!-- done: 7 findings, files read: 36 -->