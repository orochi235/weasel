# Findings: geom.paths.part2

## reachToMeet finds the crossing on one cubic approximation of the arc but places the end on another, so the end lands off the stroke
- where: packages/geom/src/paths/reachPath.ts:96 (reachToMeet)
- scenario: `mode: 'curvature'` (or `'eased'`) end with a large radius, e.g. r = 1000, boundary crossed partway round. The search builds `extensionPieces(frame, reach, ...)`: for an unbounded reach that is one full turn in four quarter cubics, each up to ~2.7e-4·r off the true circle. It records `best`, the cubic arc length to the crossing. `tugOpenEnd(path, end, best)` then rebuilds the arc for `best` alone, with a different piece count, and its end point is computed exactly on the circle (`at(i * step)`). That point is not where the search's cubic crossed the boundary: for r = 1000 it can be ~0.27 units off, either short of the stroke (a visible gap) or past it. A second Reach then finds the same stroke a sliver away (beyond `touching`) and adds another tiny piece. `'eased'` has the same shape of error: `fitSpiral` refits the drawn stretch for each distance, within `FIT_SHARE · ease`.
- evidence: read
- severity: low
- fix: packages/geom/src/paths/reachPath.ts, packages/geom/src/paths/pathEndExtension.ts
- size: function
- cause: crossing measured on one approximation, end placed by another
- confidence: likely

## resamplePath with a NaN tolerance halves every piece to the limit
- where: packages/geom/src/paths/resamplePath.ts:58 (resamplePath)
- scenario: `opts.tolerance` is NaN, e.g. from an emptied numeric field. `Math.max(NaN, 1e-6)` is NaN, so `worst(...) <= tol` and `err > tol` are both false. No piece is ever taken as straight. The halving test `err > tol` is false too, so pieces are not halved either: every piece is fitted as a cubic, including runs that are dead straight, and their anchors gain handles. A finite tolerance keeps straight runs as lines. The fallback should treat a tolerance that is not a finite positive number as the default 0.5, the way `count` already does.
- evidence: read
- severity: low
- size: line
- cause: NaN tolerance not defaulted
- confidence: sure

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
