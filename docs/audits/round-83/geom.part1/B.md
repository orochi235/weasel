# Audit round 83 — geom.part1 findings

## BVH box/point/half-space queries with a NaN coordinate visit every item instead of none
- where: packages/geom/src/bvh/bvhQuery.ts:83 (meets), :120 (notOutside); reached from packages/geom/src/bvh/bvh.ts:209 (queryBox), :213 (queryPoint), :221 (queryHalfSpaces)
- scenario: `bvh.queryPoint([NaN, 5], visit)` (a pointer mapped through a singular/NaN view, an unset coordinate). `meets` rejects only when `arr[o+j] > q[qmax+j] || q[qmin+j] > arr[o+d+j]`; both comparisons are false for NaN, so every node and every item "meets" and the whole tree is visited — a hit test reports every key. Likewise a NaN `normal`/`offset` in `queryHalfSpaces` makes `v < 0` false for every box, so nothing is ever culled. The same tree's `raycast` (`entry`, :158) and `insert`/`validBox` explicitly reject NaN, so the module answers NaN two ways: "no hit" for rays, "everything hits" for boxes and points. Should visit nothing.
- evidence: read
- severity: medium

## intersectRayPlane returns NaN, not null, for a NaN ray origin or offset
- where: packages/geom/src/3d/ray3.ts:54 (intersectRayPlane)
- scenario: `intersectRayPlane({ origin: { x: NaN, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } }, { x: 0, y: 0, z: 1 }, 0)`: `denom` is finite and passes the parallel check, `t = (offset - NaN) / denom` is NaN, and `t < 0 ? null : t` returns NaN. A caller testing `!== null` then builds a NaN point with `pointOnRay`. The neighboring `intersectRayAabb` documents and implements "null for a ray with a NaN component", so the two ray intersections disagree on the same input; this one should answer null for a non-finite `t`.
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
