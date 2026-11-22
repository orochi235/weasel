# Audit round 70 — geom.part1 findings

## A ray with an infinite direction component reports a hit at t = 0 on a box it never reaches
- where: packages/geom/src/3d/ray3.ts:37 (intersectRayAabb); same slab arithmetic in packages/geom/src/bvh/bvhQuery.ts:173 (entry)
- scenario: `intersectRayAabb({ origin: {x: 5, y: 0.5, z: 0.5}, direction: {x: Infinity, y: 0, z: 0} }, {min: {0,0,0}, max: {1,1,1}})`. On x, `t1 = (0 - 5) / Infinity = -0` and `t2 = (1 - 5) / Infinity = -0`, so the slab narrows to [-0, -0]. y and z have d = 0 with the origin inside. `tMax < 0` is false for -0, so the call returns -0, a hit at the ray's origin, even though the origin is outside the box and the ray points away from it. The BVH's `entry` does the same and returns `near = 0`, so `raycast` visits that leaf at t = 0. Both should miss: an infinite component makes every finite t on that axis collapse to 0, so the slab carries no information. A ray built from a degenerate projection (w → 0 in `transformPoint`) produces exactly this kind of direction. The NaN guard just above it shows a non-finite input was meant to be refused.
- evidence: read
- severity: low

## `aabbOfPoints` claims to answer as `boundsOfCoords` and `unionRects`, but those two disagree on NaN, and it returns an inverted box for all-NaN input
- where: packages/geom/src/3d/ray3.ts:93 (aabbOfPoints); packages/geom/src/box.ts:9 (boundsOfCoords), :93 (unionRects)
- scenario: `aabbOfPoints([{x: NaN, y: 0, z: 0}, {x: 1, y: 1, z: 1}])` skips the NaN, because comparisons with NaN are false, and gives min.x = 1. `unionRects` on the same values gives a NaN edge (its doc says it does), while `boundsOfCoords` skips the NaN as `aabbOfPoints` does. So the doc comment names two references that answer differently. Worse, `aabbOfPoints([{x: NaN, y: NaN, z: NaN}])` and `boundsOfCoords([NaN, NaN])` return `{min: +Inf, max: -Inf}` (an inverted, non-finite box) rather than the documented "null for none". `transformAabb` and `intersectRayAabb` then read that box as real (the slab test on min = +Inf, max = -Inf returns null only by luck of ordering). The rule should be stated once and followed: either propagate NaN or answer null when no finite point was seen.
- evidence: read
- severity: low

## `lengthAtCurve` throws on a non-integer or NaN `run`, while it floors and clamps `segment` and clamps `t`
- where: packages/geom/src/along/curvePosition.ts:44 (lengthAtCurve)
- scenario: `lengthAtCurve(table, { run: 0.5, segment: 0, t: 0.5 })`. `r = Math.min(Math.max(0.5, 0), runs - 1) = 0.5`, so `cum[0.5]` is undefined and `c.length` throws a TypeError. `{ run: NaN, … }` throws the same way. The same call with `segment: 0.5` is floored (`Math.floor(at.segment)`), and `t` is clamped, so one position is handled two ways depending on which field is fractional. A run index computed from arithmetic, or deserialized, crashes the length lookup. `run` should be floored as `segment` is, and NaN answered NaN as the sibling `lengthAt*` functions in lengthTable.ts do.
- evidence: read
- severity: low

## Bezier curve representations throw on a NaN parameter where NURBS answers
- where: packages/geom/src/curves/anchorHandles.ts:55 (segmentAt), reached from bezierCubic.ts:14, bezierQuadratic.ts:56, spiro.ts:13
- scenario: `bezierCubic.evaluate(anchors, NaN)` (also `curvatureAt`, and through `curvatureSourceOf(...).pointAt`). `Math.min(Math.max(NaN, 0), 1)` is NaN, so `segIdx = Math.min(Math.floor(NaN), segments - 1)` is NaN. `anchors[NaN]` is undefined, and `defaultOutHandle` reads `a.outHandle` off it, which throws a TypeError. The same is true for `bezierQuadratic` and `spiro` (`solveSpiro(...)[NaN].spiral`). `nurbs.evaluate(anchors, NaN)` goes through `clamp01`/`findSpan` and returns a value without throwing. So one `CurveRepresentation` contract gets two different answers to the same input. A comb or sampler fed a NaN t (for example 0/0 from an empty range) crashes on three representations and not on the fourth. `segmentAt` should clamp NaN, for example to 0, or every representation should answer NaN.
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

<!-- done: 4 findings, files read: 42 -->
