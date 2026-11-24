## pathCrossings reports one crossing twice where another stroke passes through a vertex
- where: packages/geom/src/intersect/pathCrossings.ts:62 (pathCrossings)
- scenario: path A = polyline (0,0)→(10,0)→(10,10); path B = line (5,-5)→(15,5), which passes exactly through A's vertex (10,0). A's segment 0 meets B at ta=1 and A's segment 1 meets B at ta=0 (the two-line branch of `segmentCrossings` accepts u=0 and u=1), and both are pushed, so `pathCrossings([A, B])` returns two `PathCrossing`s at (10,0) and `crossingStops` hands a trim two stops for one cut. `sharedEnd` only filters the joint of a path with itself; a crossing at a joint, from another path or a non-adjacent segment of the same path, is never deduplicated. Should report one crossing per point.
- evidence: read
- severity: medium

## flattenCubicWithArcLen / flattenQuadraticWithArcLen measure the first piece from whatever `out` ends with, not from the segment start
- where: packages/geom/src/flatten.ts:208 (flattenCubicArcRec), packages/geom/src/flatten.ts:258 (flattenQuadraticArcRec)
- scenario: the docs promise "cumulative distance from the segment start", but the leaf reads `lastX/lastY` off `out`'s tail and falls back to (x0, y0) only when `out` is empty. A caller that appends several segments to one `out` with a move between them (e.g. curve A ending at (100,0), then curve B starting at (0,50)) gets B's first arc length including the 100+ unit jump, so every `arcOut` value for B is offset and B's t fractions are wrong. Only callers that, like `extractPolylines`, always leave the start point as `out`'s last pair get the right answer. Should measure the first piece from (x0, y0).
- evidence: read
- severity: low

## transformAabb gives a finite, wrong box when `m` is projective and the box straddles the eye plane
- where: packages/geom/src/3d/ray3.ts:62 (transformAabb)
- scenario: `m` = a view-projection (`multiply(perspective(...), lookAt(...))`) and a local box with corners on both sides of the camera (w > 0 and w < 0). `transformPoint` divides by a negative w for the corners behind the camera, flipping them through the origin, and the min/max of the eight results is a finite box that excludes most of the true (unbounded) image. A culling or picking caller then misses geometry around the camera. Should answer an infinite box (or refuse) when the corners' w do not share a sign.
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
