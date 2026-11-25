## A cut polyline's joint that only touches a boundary counts as a crossing (knife and scissors)
- where: packages/geom/src/booleans/cutCrossings.ts:23 (cutPosition), used by crossingsOnSegment (cutCrossings.ts:44) and snipStations (splitBySegment.ts:196)
- scenario: Crossings are found per cut segment against that segment's infinite line, and a point at a joint is given to the segment that starts there. When the path passes through a joint without crossing the polyline, it still crosses the line of the segment that starts at the joint, at s = 0, so the touch is counted once. The segment ending there rejects it at s = 1. Scissors: cut V `[(-1,1),(0,0),(1,1)]` against an open path from (-2,0) to (2,0). The path only touches the V's apex, and snipStations returns one station at (0,0), so the path is snipped in two. The `snipPathByPolyline` doc says "neither does a point where the path only touches the cut". Knife: take the square [0,4]² with hole [1,3]² and the cut `(-1,0.5)→(2,1)→(5,0.5)`, whose apex touches the hole's bottom edge from inside the fill. The apex reads as a crossing with `enters = true` (against segment 1's direction), between the real entry at the left edge and the real exit at the right. The pairing then makes one chord, apex→right edge (a slit from the hole), and the left half is never cut. The cut runs edge to edge through the fill, so the knife should cut along its whole length.
- evidence: read
- severity: medium

## Mesh vertex snapping scales with distance from the origin, not with the mesh, so a small float64 mesh far out is distorted
- where: packages/geom/src/booleans/meshJunctions.ts:72 (junctionRings, `eps = scale * ON_EDGE`); also coverageBoundary.ts:66 (`size * SAME_POINT`)
- scenario: `scale` is the largest absolute coordinate, so `eps` grows with the offset. `trianglesToPath` takes any `ArrayLike<number>`, float64 included. Take a mesh 1 unit wide at x ≈ 1e6: eps ≈ 0.95. Any mesh vertex within 0.95 of another triangle's edge (and more than eps from its ends) is spliced into that triangle's ring, though it lies well off the edge. The rings become non-simple, and the outline traced from them is wrong. The same mesh at the origin is exact. coverageBoundary also merges every boundary point within `1e6 · 2^-28 ≈ 0.0037` of another, whatever the mesh's own size. The bound should come from the mesh's extent, or from the float32 resolution of its coordinates only when they are float32.
- evidence: read
- severity: medium

## Docs say curve booleans flatten self-crossing cubics, but the cut has handled them since 466b04ef9d
- where: packages/geom/src/booleans/ops.ts:7 (module doc); packages/geom/src/booleans/splitBySegment.ts:66 (splitPathByPolyline doc)
- scenario: ops.ts says union/intersect/subtract/exclude fall back to the polygon clipper for "the cases `curveBoolean` declines (self-crossing cubics, some tangencies)". splitPathByPolyline says `pathUnion` keeps curves "except in the few cases that union flattens (a cubic that crosses itself, say)". `cutEdges` now cuts a self-crossing cubic at its crossing first (`unlooped`, curveEdges.ts:141), so such inputs keep their curves. A caller relying on the doc and expecting M/L/Z output gets curves.
- evidence: read
- severity: low

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
packages/geom/src/booleans/ringFill.ts
packages/geom/src/booleans/snipAtCrossings.ts
packages/geom/src/booleans/splitBySegment.ts
packages/geom/src/booleans/trianglesToPath.ts
packages/geom/src/booleans/vertexFans.ts

<!-- done: 3 findings, files read: 32 -->
