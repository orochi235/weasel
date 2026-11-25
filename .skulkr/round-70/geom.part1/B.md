# Audit round 70 — geom.part1 findings

## `squarable` turns a direction with a subnormal largest component into Infinity/NaN, so nearestPointOnLine and nearestPointsRayLine answer the origin or NaN
- where: packages/geom/src/3d/ray3.ts:124 (squarable), reached from nearestPointOnLine (:110) and nearestPointsRayLine (:145)
- scenario: `nearestPointOnLine({x:1,y:1,z:0}, {x:0,y:0,z:0}, {x:1e-310,y:0,z:0})`. `len2` underflows to 0, so `squarable` rescales with `scale(v, 1 / k)`. `1 / 1e-310` overflows to Infinity (any `k` below 2^-1024 ≈ 5.6e-309 does), so `v` becomes `{x: Infinity, y: 0*Infinity = NaN, z: NaN}`. `d2` is NaN, `!(d2 > 0)` holds, and the call returns `origin` (0,0,0) instead of (1,0,0). The doc reserves that answer for a zero direction. In `nearestPointsRayLine`, with the same kind of line direction, `c` is NaN, `s = 0` and `onLine = add(origin, scale(v, 0))` is NaN in every component. A subnormal ray direction gives `a = NaN` and the same NaNs. The helper exists so that a direction whose square underflows still projects. `vec3.normalize` handles the same range correctly by dividing each component by `m` (`a.x / m`) rather than multiplying by `1 / m`. Dividing here, as `normalize` and `lengthOf3` do, fixes it.
- evidence: read
- severity: low

## `segmentCrossings` reports no touch for a zero-length line lying on the other segment
- where: packages/geom/src/intersect/segmentIntersections.ts:136 (segmentCrossings) → :92 (collinearOverlap)
- scenario: `segmentCrossings([{x:5,y:0},{x:5,y:0}], [{x:0,y:0},{x:10,y:0}])`. `nearlyParallel(0, 0, 10, 0)` is true, because `|0| > 0` fails, so the call goes to `collinearOverlap`. That returns `[]` as soon as `rr === 0`. The doc promises every point where `a` crosses or *touches* `b`, and the point (5,0) lies on `b`, so this should answer `[{ta: 0, tb: 0.5, x: 5, y: 0}]`. The same happens with the arguments swapped (`ss === 0`). `pathSegments` drops zero-length lines, so `pathCrossings` never sends one. A direct caller of the public `segmentCrossings` (root barrel export) gets a silent miss.
- evidence: read
- severity: low

## `lengthAtCurve` throws on a NaN run index, where every sibling query answers NaN
- where: packages/geom/src/along/curvePosition.ts:44 (lengthAtCurve)
- scenario: `lengthAtCurve(table, {run: NaN, segment: 0, t: 0.5})`. `Math.min(Math.max(NaN, 0), n - 1)` is NaN, `r < 0` is false, `cum[NaN]` is undefined, and `c.length` throws a TypeError. The neighboring queries in the same module family (`lengthAtAnchor`, `anchorAtLength`, `lengthAtSubpath`, `lengthAtSegmentFraction`) each check `Number.isNaN` explicitly and return NaN, and `pointAtLength` maps NaN to 0. A `CurvePosition` read back from a serialized or animated value carrying NaN crashes the caller instead of propagating.
- evidence: read
- severity: low

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

<!-- done: 3 findings, files read: 42 -->
