# Audit round 49 — geom.part1 findings

## lengthTable measures a straight segment as length 0 when its squared length over- or underflows
- where: packages/geom/src/along/lengthTable.ts:203 (runLengths)
- scenario: a polyline run with points (0,0)→(1e160,0) (or (0,0)→(1e-170,0)): `d2` sums squares, overflowing to Infinity (or underflowing to 0); the `Number.isFinite(d2) ? Math.sqrt(d2) : 0` guard then records the segment as covering no distance, so `total` is 0 and `pointAtLength` never leaves the first point. A curved segment of the same span is measured correctly (farScale.test covers 1e±160 for curves). Should use `Math.hypot` over the components, as the curve path and `direction()` in positions.ts already do.
- evidence: read
- severity: medium

## 3D `len` and `distance` overflow and underflow where `normalize` does not
- where: packages/geom/src/3d/vec3.ts:60 (len), :88 (distance)
- scenario: `len({x:1e200,y:0,z:0})` is `Math.sqrt(1e400)` = Infinity, and `len({x:1e-200,...})` is 0, though `normalize` of the same vector rescales and succeeds. Callers inherit it: `intersectRayPlane` (ray3.ts:53) multiplies `len(normal) * len(direction)`, so a ray with a 1e-170 direction (or a 1e200 normal) returns null as "parallel" even when perpendicular to the plane. Likewise `nearestPointOnLine` (ray3.ts:111) and `nearestPointsRayLine` (ray3.ts:136) read `len2` of a 1e-170 direction as 0 and treat the line as the point `origin` / the ray as having no direction. Should be `Math.hypot(a.x, a.y, a.z)`, the rule the 2D side adopted (commit c13286b824).
- evidence: read
- severity: low

## Quadratic and NURBS curve reps zero a small curve's curvature on an absolute threshold; the cubic rep judges it by scale
- where: packages/geom/src/curves/bezierQuadratic.ts:88 (bezierQuadratic.curvatureAt); packages/geom/src/curves/nurbs.ts:129 (nurbs.curvatureAt)
- scenario: anchors (0,0), (1e-5,1e-5), (2e-5,0) — a tight arc a few hundred-thousandths across. The quadratic's speed is ~1e-5, so `den = speed^3` ~ 1e-15 < 1e-12 and `curvatureAt` returns 0 everywhere, though the true curvature is ~1e5; the curvature comb (`curvatureSourceOf`) draws the curve as straight. `bezierCubic.curvatureAt` on the same anchors goes through `cubicCurvatureAt`, which judges speed against the control polygon's own reach (`speed > EPS * reach`) and answers the real curvature. One question (does this curve have a direction here?) is answered two ways; the two reps should share the scale-relative test. `Math.pow(d1², 1.5)` also overflows for curves past ~1e100, giving 0 curvature.
- evidence: read
- severity: low

## pathCrossings never finds a cubic segment crossing itself
- where: packages/geom/src/intersect/pathCrossings.ts:55 (pathCrossings)
- scenario: a path `M 0 0 C 150 100 -50 100 100 0` — one cubic whose crossed handles make it loop over itself (its points at t ≈ 0.173 and t ≈ 0.827 coincide, near (50, 43), worked by hand). For `i === j` the inner loop starts at `n = m + 1`, so a segment is only ever tested against later segments, never against itself, and `segmentCrossings` has no single-segment self-intersection mode. `pathCrossings([loop])` returns `[]`, and `crossingStops` offers a trim no cut at the loop's crossing, though the doc promises "every crossing … of a path with itself". The same loop drawn as two cubics (split at its apex) is found. A segment's own crossing (a cubic's double point) needs its own test.
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
