# Audit round 83 — geom.booleans — findings

## orientBoundaries drops a whole contour when its probe segment has a zero tangent at t = 0.5 (cusp cubic)
- where: packages/geom/src/booleans/contours.ts:160 (orientBoundaries)
- scenario: the probe is the segment with the longest chord, and `derivSeg(probe, 0.5)` is zero for a symmetric cusp cubic, e.g. `M0 0 C1 1 0 1 1 0 Z` (derivative at 0.5 ∝ (p3−p0)+(p2−p1) = (0,0); the cubic's chord ties the closing line's at 1, and the cubic wins because it comes first). `if (tl === 0) continue` then drops the contour from the boundaries entirely, though it bounds fill. `splitPathBySegment` / `splitPathByPolyline` on that teardrop gets `boundaries.length === 0` from `resolveBoundaries` and returns null: a cut straight across it splits nothing. The fix should do what `coverEdges` (curveClassify.ts) already does when the tangent vanishes: fall back to the chord direction, or probe another parameter or segment, instead of discarding the contour.
- evidence: read
- severity: medium

## snipPathByPolyline cuts a path that only runs along the cut and leaves on the side it came from
- where: packages/geom/src/booleans/splitBySegment.ts:196 (snipStations)
- scenario: open path `M0 -1 L0 0 L2 0 L2 -1`, cut (−1,0)→(3,0). With `zeroIsPositive`, segment A (f = [−4, 0]) reports a sign change at t≈1, the segment lying on the cut reports none, and segment C (f = [0, −4]) reports one at t≈0. The two detections are at different points (0,0) and (2,0), so the pairing step that removes touches never pairs them, and the path is cut into three pieces. The path never crosses the cut: it touches it along a stretch and returns to the side it came from, and the doc says a touch cuts nothing. `findCrossings` (cutCrossings.ts) answers the same question the other way: it takes a run along the cut as a single crossing at the run's end, and only when the sides before and after differ.
- evidence: read
- severity: low

## The clipper's retry grid is scaled by the largest coordinate, not the inputs' extent, so a small shape far from the origin is snapped out of shape
- where: packages/geom/src/booleans/clipper.ts:16 (sizeOf / robust)
- scenario: `sizeOf` returns the largest |x| or |y|, so the grid step is set by distance from the origin. Take two unit-sized float64 operands at x ≈ 1e8 (world coordinates from `worldCoords`, which polygon-clipping receives as float64) where the unsnapped call throws. The retries snap to 1e8·2^-40 ≈ 9e-5, then 1e8·2^-30 ≈ 0.09, then 1e8·2^-24 ≈ 6. If the finer grids also throw, the 6-unit grid collapses the unit shapes to points, and an empty or wrong result comes back with no throw. Scaling the step by the inputs' extent (or their bounding box size), not their distance from the origin, avoids this.
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
