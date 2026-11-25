# Audit 83 — geom.part1 findings

## BVH box, point and half-space queries with a NaN coordinate (or a short box) visit every item
- where: packages/geom/src/bvh/bvhQuery.ts:83 (meets), :120 (notOutside); reached from packages/geom/src/bvh/bvh.ts:200-206 (queryBox, queryPoint, queryHalfSpaces)
- scenario: `meets` rejects only when `arr[o+j] > q[qmax+j] || q[qmin+j] > arr[o+d+j]` is true; with a NaN query coordinate both comparisons are false, so every node and item "meets". `bvh.queryPoint([NaN, NaN], visit)` (a pointer position computed through a singular view, say) visits every key in the tree instead of none. The same goes for a box shorter than `2 * dim` (a 2D `[x0, y0, x1, y1]` passed to a 3D tree: the missing axes read `undefined`, and every comparison with it is false). `notOutside` has the same hole: a NaN `offset` or normal component makes `v` NaN, `v < 0` is false, and every item counts as inside. `insert`/`update` reject the same inputs through `validBox`, so the tree refuses to store a NaN box but answers a NaN query with everything. Expected: no visits, or a throw, for a NaN/short query.
- evidence: read
- severity: medium

## BVH raycast with an infinite direction component ignores a negative `tMax`
- where: packages/geom/src/bvh/bvhQuery.ts:150 (entry)
- scenario: for an axis whose direction is ±Infinity, `entry` sets `far = 0` outright, where `intersectRayAabb` (ray3.ts:37) takes `Math.min(tMax, 0)`. With `tMax < 0` (a caller passing a clipped or already-exhausted range) and that axis processed before any finite one, `far` is raised from `tMax` to 0, `near (0) > far (0)` is false, and the item is visited at t = 0. The same ray with a finite or zero direction on that axis misses every box (`near 0 > far tMax`). Expected `far = Math.min(far, 0)`.
- evidence: read
- severity: low

## `nearestPointsRayLine` counts a ray and line as parallel up to an angle of 1e-6 rad, not SINGULAR_RATIO
- where: packages/geom/src/3d/ray3.ts:163 (nearestPointsRayLine)
- scenario: `denom = a·c − b²` is `a·c·sin²θ`, and the test is `denom > SINGULAR_RATIO * a * c`, so the cut-off is `sin θ > 1e-6`, the square root of the ratio every other test in the file uses on the quantity itself (`intersectRayPlane` compares `|cos|` against SINGULAR_RATIO, `lookAt` compares `|sin|`, `nearlyParallel` compares `|sin|`). A ray and an axis line 1e-7 rad apart — well above rounding, since the relative error in `denom` is ~1e-16 against sin² = 1e-14 — get `t = 0` and the line point nearest the ray's origin, instead of the true closest pair. The "parallel" judgment is answered one way here and another in the neighboring functions. Expected `denom > SINGULAR_RATIO * SINGULAR_RATIO * a * c` (or compare `sqrt(denom)` against `SINGULAR_RATIO * sqrt(a c)`).
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
