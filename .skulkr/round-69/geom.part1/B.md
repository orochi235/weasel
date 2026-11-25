# Findings: geom.part1

## 3D `invert` returns a matrix with NaN/Infinity translation for an affine input with non-finite translation; 2D `invert` returns null
- where: packages/geom/src/3d/mat4.ts:95 (invert)
- scenario: `invert([1,0,0,0, 0,1,0,0, 0,0,1,0, Infinity,0,0,1])`. The matrix is affine, so `norm1` judges only the 3x3 block (finite, identity), `invertible` passes, and the inverse's translation column (`inv[12..14]`, built from `b06/b07/b09`, which multiply `m30 = Infinity`) is `-Infinity`/`NaN`. The doc promises null for a "non-finite" matrix, and the 2D `invert` (`affine.ts:63`) checks `m[4]`/`m[5]` finiteness and returns null for the same input. One decision answered two ways; a 3D caller gets a NaN-poisoned matrix instead of null.
- evidence: read
- severity: medium

## `pathCrossings` reports the closing joint of a one-cubic closed subpath as a self-crossing
- where: packages/geom/src/intersect/pathCrossings.ts:55 (pathCrossings → segmentSelfCrossing, segmentIntersections.ts:180)
- scenario: a teardrop drawn as one cubic closed on its start, `M 0 0 C 100 0 100 100 0 0 Z`. `pathSegments` drops the zero-length closing line, so the subpath is one closed cubic with `p0 === p3`. For it `a + b + c = p3 − p0 = 0`, so the double point `segmentSelfCrossing` solves for is exactly σ = 1, π = 0: ta = 0, tb = 1, the segment's own joint. `pathCrossings` pushes that unconditionally (`sharedEnd` only filters between two different adjacent segments), so the joint where the subpath closes comes back as a crossing, and `crossingStops` hands a trim two spurious cuts at t = 0 and t = 1. Whether the joint shows up also depends on rounding: `!(ta >= 0 && tb <= 1)` drops it when ta rounds to −1e-17. The rule the doc states ("leaving out the joint where one segment meets the next") is applied between segments but not to a closed subpath's single segment meeting itself.
- evidence: read
- severity: low

## `pointAtLength` at a run's start falls back to a neighboring curve's chord rather than its tangent
- where: packages/geom/src/along/positions.ts:81 (tangentNear / direction)
- scenario: a run whose first segment has no length, followed by a curve, e.g. anchors (0,0) → (0,0) by a line, then `C 50 0 100 50 100 100`, queried at s = 0. The search picks segment 0 (since `c[1] >= 0`), which is straight with no length, so `tangentNear` walks forward and `direction(t, r, 1)` returns the unit chord (0,0)→(100,100), i.e. (0.707, 0.707). The tangent there is the curve's start direction (1, 0). The doc says the tangent on a curve is "the curve's own direction", and `bezierDirection` gives it, but `tangentNear` only knows straight chords. The same happens looking back from any degenerate segment whose neighbor is curved. This needs the zero-length first segment to survive into the table's runs.
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
