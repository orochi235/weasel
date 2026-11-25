# Findings: geom.booleans (round 49)

## contoursIntersect reports every contour after the first as crossing itself at its closing vertex
- where: packages/geom/src/booleans/contours.ts:104 (contoursIntersect)
- scenario: the wrap-around adjacency skip tests `i === 0` (the global edge index) instead of `e.i === 0` (the index within the contour). For contour 0 the two coincide; for any later contour the first and last flattened edges share `pts[0]`, are not skipped, and `segmentsCross` counts a shared endpoint as a crossing (d1 = 0 ≠ d2). So a path of two disjoint rectangles, or a rect with a separate hole contour, is judged self-intersecting, and `splitPathByPolyline`/`splitPathBySegment` (`resolveBoundaries`) send every multi-contour path through `pathUnion` (straight-line inputs come back re-ordered and re-started by polygon-clipping, and curved ones are subject to `curveBoolean`'s declines and get flattened) instead of the documented "only a path whose contours do cross is resolved by a union first".
- evidence: read
- severity: medium

## The face arrangement merges vertices at a billionth of the largest coordinate, so small curved shapes far from the origin collapse
- where: packages/geom/src/booleans/arrangement.ts:152 (arrangeLines), reached from packages/geom/src/booleans/curveFaces.ts:226 (curveFaces, no `eps` passed)
- scenario: `arrangeLines` sets its vertex-merge and cut tolerance to `1e-9 * max |coordinate|`, while `curveFaces` flattens to `1e-5` of the inputs' own diagonal. The chords of a radius-1 circle are about 0.013 long. Centered at x = 1e7 the merge tolerance is 0.01, the same size as a chord; at 1e8 it is 0.1 and at 1e9 it is 1. `VertexPool` then merges consecutive chord ends, `arrangeLines` drops the zero-length edges (`id === prev`), and `pathFaceArrangement`/`pathDivide`/`pathFacePieces` of small shapes there return crude polygons, or no faces at all. float64 places these points to about 1e-7 at 1e9, and geom's paths carry an `origin` precisely so geometry far out keeps its precision. The tolerance should follow the inputs' extent, as `cutEdges`' snap (`extent * 1e-6`) does, floored at the coordinates' ulp, not their magnitude.
- evidence: read
- severity: medium

## Files read
packages/geom/src/booleans/adapter.ts
packages/geom/src/booleans/arrangement.ts
packages/geom/src/booleans/clipper.ts
packages/geom/src/booleans/contourSegments.ts
packages/geom/src/booleans/contours.ts
packages/geom/src/booleans/coverageBoundary.ts
packages/geom/src/booleans/crossingPolish.ts
packages/geom/src/booleans/curveBoolean.ts
packages/geom/src/booleans/curveClassify.ts
packages/geom/src/booleans/curveEdges.ts
packages/geom/src/booleans/curveFaces.ts
packages/geom/src/booleans/curveOverlap.ts
packages/geom/src/booleans/curvePieces.ts
packages/geom/src/booleans/curveShapes.fixtures.ts
packages/geom/src/booleans/curveTrace.ts
packages/geom/src/booleans/cutCrossings.ts
packages/geom/src/booleans/cutLoops.ts
packages/geom/src/booleans/cutPolyline.ts
packages/geom/src/booleans/cutRegions.ts
packages/geom/src/booleans/edgeCrossings.ts
packages/geom/src/booleans/faceArrangement.bench.ts
packages/geom/src/booleans/faceCycles.ts
packages/geom/src/booleans/glyphCell.fixture.ts
packages/geom/src/booleans/index.ts
packages/geom/src/booleans/meshJunctions.ts
packages/geom/src/booleans/meshOutline.ts
packages/geom/src/booleans/ops.ts
packages/geom/src/booleans/snipAtCrossings.ts
packages/geom/src/booleans/splitBySegment.ts
packages/geom/src/booleans/trianglesToPath.ts
packages/geom/src/booleans/vertexFans.ts

<!-- done: 2 findings, files read: 31 -->
