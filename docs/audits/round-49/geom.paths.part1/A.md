# Findings: geom.paths.part1 (round 49)

## pathToAnchors upgrades a quadratic to a cubic by reusing its control point as both handles, which changes the curve
- where: packages/geom/src/paths/anchors.ts:82 (pathToAnchors, PATH_Q case)
- scenario: a path `M 0 0 Q 50 100 100 0` decodes to anchors with `outHandle = inHandle = (50, 100)`; any anchor edit (`editAnchorSet` → `anchorsToPath`) re-encodes it as `C 50 100 50 100 100 0`, whose peak is at y = 75 instead of the quadratic's y = 50. Every Q segment in a path visibly bulges the moment any anchor of it is edited (even an edit to an unrelated subpath). Degree elevation needs `c1 = p0 + 2/3·(q − p0)`, `c2 = p3 + 2/3·(q − p3)`; the doc comment's "this loses no geometry" is false. Smoothness detection (`isAnchorSmooth`) and `segmentAt`/`nearestSegmentT` hit-testing also run on the wrong curve. The same decision is answered correctly elsewhere in the area: `cornerSegments.ts:69` (decodeContours), `cubicContours.ts:89` and `bounds.ts:49` all elevate with the 2/3 rule, so corner expansion, bounds and warps see one curve and every anchor edit writes another. (`anchorOrigins.ts` heldBy relies on the reused control point to map both handles to the Q's single control index; `anchorOrigins.test.ts:72` pins `[0, 1, 1, 2]`, so a fix has to carry that mapping explicitly.)
- evidence: read
- severity: high

## offsetCornerTraces reads a `square` corner as concave, so its trace moves the wrong way and an offset drops the spec
- where: packages/geom/src/paths/cornerOffset.ts:41 (offsetCornerTraces)
- scenario: the convex/concave test probes a point "between the anchor and its cut", assuming that region is unfilled on a convex corner. For `shape: 'square'` (k = +∞) `cornerShapePieces` draws the cut as two lines through `frame.outer`, which between straight edges is the anchor itself, so the probe lands inside the fill. A convex square corner of radius 10 on a rect grown by `distance = 2` then gets `sign = -1`: its trace is placed 2/sin(45°) *inside* the anchor with radius 8, instead of outside with radius 12. `restoreCorners` never finds that trace on the offset outline, so the result keeps the expanded geometry and loses the corner spec (the shape can no longer be edited as a corner). Same for any convex k large enough that `exponentOf` returns Infinity.
- evidence: read
- severity: low

## Files read
packages/geom/src/paths/anchorBrush.ts
packages/geom/src/paths/anchorEdits.ts
packages/geom/src/paths/anchorFields.ts
packages/geom/src/paths/anchorOrigins.ts
packages/geom/src/paths/anchorSelection.ts
packages/geom/src/paths/anchorSymmetry.ts
packages/geom/src/paths/anchorValues.ts
packages/geom/src/paths/anchors.ts
packages/geom/src/paths/arcRun.ts
packages/geom/src/paths/bendAlongPath.ts
packages/geom/src/paths/bendSegment.ts
packages/geom/src/paths/bounds.ts
packages/geom/src/paths/boundsOfPaths.ts
packages/geom/src/paths/builder.ts
packages/geom/src/paths/compose.ts
packages/geom/src/paths/contourSamples.ts
packages/geom/src/paths/cornerCarry.ts
packages/geom/src/paths/cornerOffset.ts
packages/geom/src/paths/cornerRestore.ts
packages/geom/src/paths/cornerSegments.ts
packages/geom/src/paths/cornerShape.ts
packages/geom/src/paths/cornerSpec.ts
packages/geom/src/paths/corners.ts
packages/geom/src/paths/crossingsAmong.ts
packages/geom/src/paths/cubicContours.ts
packages/geom/src/paths/cubicMath.ts
packages/geom/src/paths/curvature.ts
packages/geom/src/paths/drape.ts
packages/geom/src/paths/eulerSpiral.ts
packages/geom/src/paths/extremaAnchors.ts
packages/geom/src/paths/fairing.ts
packages/geom/src/paths/fitHandles.ts
packages/geom/src/paths/fitRun.ts
packages/geom/src/paths/growRegion.ts
packages/geom/src/paths/handleEdits.ts
packages/geom/src/paths/joinAnchors.ts
packages/geom/src/paths/kneadPath.ts

<!-- done: 2 findings, files read: 37 -->
