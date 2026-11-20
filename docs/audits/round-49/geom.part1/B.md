# Findings — geom.part1 (round 49, reviewer B)

## nearestPointsRayLine pairs a zero-direction line (a point) with the ray's origin instead of the ray's nearest point to it
- where: packages/geom/src/3d/ray3.ts:143 (nearestPointsRayLine)
- scenario: `direction = {0,0,0}` (the line degenerates to the point `origin`, as `nearestPointOnLine` beside it treats a zero direction), ray `{origin:(0,0,0), direction:(1,0,0)}`, line origin `(5,3,0)`. `c = 0` makes `denom = 0`, so `t` stays 0 and `onRay` is the ray's origin `(0,0,0)`, distance √34. The nearest pair is `onRay = (5,0,0)`, `t = 5` (`max(0, -d/a)`), distance 3. The doc only promises the ray-origin fallback for a line *parallel* to the ray; a point is not parallel to anything, and `nearestPointOnLine` in the same file answers the degenerate line as its point.
- evidence: read
- severity: low

## pathCrossings never tests a segment against itself, so a looped cubic's self-crossing is never reported
- where: packages/geom/src/intersect/pathCrossings.ts:55 (pathCrossings)
- scenario: a path `M 0 0 C 300 300 -200 300 100 0` — one cubic whose control polygon crosses, so the curve loops and crosses itself once. With `i === j` the inner loop starts at `n = m + 1`, so segment 0 is only ever paired with later segments; there are none, and `pathCrossings([path])` returns `[]`. The doc promises every crossing "of a path with itself", and the callers depend on it: `snipPathAt` (via `crossingStops`) returns null for a probe on the loop because "nothing crosses or touches the subpath", and `pathSnap`'s intersection targets miss the loop point. The loop's crossing needs a per-segment self-intersection solve (`segmentCrossings(a, a)` would not do; it reports the whole overlap).
- evidence: read
- severity: medium

## The curve representations' `toPath` write world coordinates straight into a Float32Array with no `origin`, losing precision far from the origin
- where: packages/geom/src/curves/bezierCubic.ts:34 (bezierCubic.toPath); packages/geom/src/curves/bezierQuadratic.ts:74 (bezierQuadratic.toPath); packages/geom/src/curves/nurbs.ts:109 (nurbs.toPath)
- scenario: anchors at `x = 1_000_000.3` (a document scrolled far out, or a map in world units). `new Float32Array(xs)` rounds each coord to float32's 1/16 grid there, so the path drawn and hit-tested sits up to 0.03 units off the anchors `evaluate` answers, and closer anchors collapse together; at 1e7 the grid is a whole unit. `PolygonPath.origin` exists for exactly this ("a float32 coordinate at 262,144 is on a 1/32 grid"), and the rest of the package builds paths with `originFor` + `coordsFrom` (e.g. `booleans/cutRegions.ts` `writePath`); these three builders skip it, while the fourth, `spiro.toPath`, goes through `spiroToPath`. The paths should be built through `originFor`/`coordsFrom` as `writePath` does.
- evidence: read
- severity: medium

## A subpath opened after `Z` without an `M` restarts at the previous subpath's anchor id, so the length table's anchor breakpoints stop ascending and its anchor queries answer on the wrong subpath
- where: packages/geom/src/along/lengthTable.ts:220 (anchorBreakpoints), queried by lengthAtAnchor:115, anchorAtLength:137 and lengthAtSegmentFraction:168; numbering from packages/geom/src/along/pathTable.ts:43 (anchorRun)
- scenario: `pathLengthTable` of `M0 0 L10 0 L10 10 Z L20 20` (a drawing command after `Z` opens a subpath at the pen, as `forEachSegment` documents). `extractPolylines` starts the second run with `startAnchor` = 0, so its ids are `[0, 3]`, while the first, closed run already contributed `[0, 1, 2, 3]` (its closing edge numbered `last + 1 = 3`). `bpAnchor` is `[0,1,2,3,0,3]` against `bpLength` `[0,10,20,34.1,34.1,62.4]`, breaking the "both ascending" invariant both binary searches rely on. Results: `anchorAtLength(t, 40)` — a point on the `L20 20` segment — answers `0.62`, and `lengthAtAnchor(t, 0.62)` gives 6.2, not 40; `segments` counts run 2 as `3 - 0 = 3` segments (6 in total for a path with 4), so `lengthAtSegmentFraction(t, 0.75)` answers 15, a point on the first triangle, rather than a point on the last segment. Run 2's first breakpoint needs an id that orders after run 1's, or the queries need to search per run.
- evidence: read
- severity: medium

## Files read
packages/geom/src/3d/along3.ts
packages/geom/src/3d/index.ts
packages/geom/src/3d/mat4.ts
packages/geom/src/3d/portCurve3.ts
packages/geom/src/3d/ray3.ts
packages/geom/src/3d/vec3.ts
packages/geom/src/affine.ts
packages/geom/src/affineFit.ts
packages/geom/src/along/along.bench.ts
packages/geom/src/along/arcLookup.ts
packages/geom/src/along/bezier.ts
packages/geom/src/along/curvePosition.ts
packages/geom/src/along/lengthTable.ts
packages/geom/src/along/pathTable.ts
packages/geom/src/along/positions.ts
packages/geom/src/angle.ts
packages/geom/src/box.ts
packages/geom/src/bvh/bvh.ts
packages/geom/src/bvh/bvhQuery.ts
packages/geom/src/bvh/bvhTree.ts
packages/geom/src/bvh/settledCache.ts
packages/geom/src/commands.ts
packages/geom/src/curve.ts
packages/geom/src/curves/anchorHandles.ts
packages/geom/src/curves/bezierCubic.ts
packages/geom/src/curves/bezierQuadratic.ts
packages/geom/src/curves/curvatureSource.ts
packages/geom/src/curves/index.ts
packages/geom/src/curves/nurbs.ts
packages/geom/src/curves/spiro.ts
packages/geom/src/curves/types.ts
packages/geom/src/easingSpec.ts
packages/geom/src/easings.ts
packages/geom/src/flatten.ts
packages/geom/src/glMat3.ts
packages/geom/src/index.ts
packages/geom/src/intersect/pathCrossings.ts
packages/geom/src/intersect/pathSegments.ts
packages/geom/src/intersect/segmentIntersections.ts
packages/geom/src/intersect/writeSubpaths.ts
packages/geom/src/meanScale.ts
packages/geom/src/nd/index.ts

<!-- done: 4 findings, files read: 42 -->
