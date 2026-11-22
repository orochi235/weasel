# Audit round 69 — geom.part1 findings

## `solveForX` gives up after 12 bisection steps, so a curve where Newton bails is only solved to ~2^-12, far short of its own 1e-7 epsilon
- where: packages/geom/src/easingSpec.ts:48 (solveForX)
- scenario: `cubicBezierEasing(0.42, 0, 1, 1)` (CSS `ease-in`) at progress `x = 0.9999`. The slope at `t = 0.9999` is about 3.5e-4, under `NEWTON_MIN_SLOPE`, so Newton breaks right away. Bisection then restarts over [0, 1] from the clamped guess and stops after `SUBDIVISION_MAX = 12` halvings. That leaves `t` within about 4.9e-4 of the true root (t* ≈ 0.9924), while `SUBDIVISION_EPSILON` asks for 1e-7. The loop just returns the last midpoint without ever reaching its error test. The same happens near any end where x(t) flattens out (x1 = 0 or x2 = 1, e.g. `cubic-bezier(0,0,0,1)` near x = 0). Output is off by 1e-5 to 1e-4 in eased progress, where browsers solve to about 1e-7. The bisection needs to run until `|err| < SUBDIVISION_EPSILON` (it can take about 24 steps from [0, 1]) or start from the Newton bracket.
- evidence: read
- severity: low

## `bezierCubic.discriminators` offers an `out` handle on the last anchor and an `in` handle on the first, and neither is used by any segment
- where: packages/geom/src/curves/bezierCubic.ts:45 (discriminators)
- scenario: anchors `[A{outHandle}, B, C{outHandle}]`. On C, `a.outHandle || i + 1 < anchors.length` is true, so a `handle/out` discriminator is emitted for C. But `toPath`, `evaluate` and `curvatureAt` only read `outHandle` of anchors 0..n-2 (through `defaultOutHandle(anchors, i)` for `i + 1 < n`), so dragging that handle changes nothing. The first anchor's `inHandle` is the same: `defaultInHandle` reads `anchors[i + 1].inHandle`, never anchor 0's. The panel shows a live-looking control that does nothing. It should be emitted only for `i + 1 < n` (out) and `i > 0` (in).
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

<!-- done: 2 findings, files read: 42 -->
