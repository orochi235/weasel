# Audit round 69 — geom.paths.part2

## resamplePath allocates pieces with no bound, so a small `spacing` (or a huge `count`) hangs
- where: packages/geom/src/paths/resamplePath.ts:102 (allocate), :106
- scenario: `resamplePath(path, { spacing: 1e-6 })` on a path 1000 units long gives `span.pieces = round(1000 / 1e-6) = 1e9`. `appendSpan` then calls `fitPiece` a billion times, each sampling 17 points and possibly halving, so the call never returns and memory grows without limit. `count: 1e9` does the same through the largest-remainder branch: only non-finite counts are filtered. A spacing slider dragged toward 0, or a typed count, is enough to cause it. The pieces need a cap, the way `countParam` caps other per-segment counts at 1000, or the spacing needs a floor relative to `tolerance`.
- evidence: read
- severity: medium

## spiroToPath drops `closed` on a two-point contour, so reading the path back reopens it
- where: packages/geom/src/paths/spiroPath.ts:95 (spiroToPath), :128 (spiroContoursOf)
- scenario: given a contour `{ points: [p, q], closed: true }`, `spiroToPath` writes it with `closed.push(c.closed && c.points.length > 2)`, which is false. `spiroContoursOf(path, kinds, at)` reads `closed[s]` from the path, so the contour comes back as `closed: false`. An editor that stores the path, reads the contours back and then adds a third point gets an open curve, although the user closed it. The two-point limit belongs in the solve (`solveSpiro` already treats it as open) and must not end up in the stored closure.
- evidence: read
- severity: low

## tweenPaths' subdivideTo spreads every segment length into Math.max, which throws on a large contour and is quadratic below that
- where: packages/geom/src/paths/tweenPaths.ts:144 (subdivideTo)
- scenario: tween a 4-segment rectangle against a traced or imported contour of about 200k segments. `subdivideTo` splits the rectangle one segment at a time and calls `Math.max(...lengths)` on every split. Once `out` reaches V8's argument-spread limit, which is on the order of 10^5, that call throws `RangeError: Maximum call stack size exceeded`, so `prepareTween` throws where it should return a tween. Below the limit, each split remeasures every segment (`out.map(hullLength)`) and splices the array, which comes to O(n²): 20k segments already means about 4·10^8 hull measurements, run again for every rotation and both directions `matchContours` tries under `autoAlign`, which multiplies it by 2·(segment count). Fixing it needs a loop or a heap for the maximum and a per-segment split count rather than one split at a time.
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
