# Findings: geom.paths.part1

## outsideSide divides by a zero tangent and sends windingOf into a 2^40 recursion
- where: packages/geom/src/paths/contourSides.ts:52 (outsideSide)
- scenario: growRegion on a path with two or more contours, one of them a closed out-and-back cusp curve such as `M0 0 C10 0 10 0 0 0 Z` beside an ordinary square. That curve is its contour's longest segment. Its derivative at t = 0.5 is zero (`l.c[6]-l.c[4]` = 0), and its chord is zero too, so the fallback also gives `tx = ty = 0` and `tl = 0`. Then `nx`/`ny` are NaN, and `windingOf(contours, NaN, NaN)` reaches `crossings`, where every comparison against NaN is false. Neither early return fires and the `minX > px` fallback never does either, so every segment splits in two until depth 40: about 10^12 calls, a hang. It should answer `null` (no side) for a contour with no usable tangent.
- evidence: read
- severity: medium
- fix: packages/geom/src/paths/contourSides.ts
- size: line
- cause: no guard for a zero tangent length
- confidence: sure

## boundsOfPaths pulls the union out to (0, 0) for any empty path in the set
- where: packages/geom/src/paths/boundsOfPaths.ts:18 (boundsOfPaths)
- scenario: `boundsOfPath` returns a zero-size rect at (0, 0) for a path with no commands (for example `polygonFromPoints([])`), whatever the path's origin. boundsOfPaths folds that rect in like any other, so the envelope of `[emptyPath, shapeAt(10000, 10000)]` runs from (0, 0) to the shape's far corner rather than covering only the shape. An empty path has no extent and should be skipped (and the result should be `null` if every path is empty).
- evidence: read
- severity: low
- fix: packages/geom/src/paths/boundsOfPaths.ts, packages/geom/src/paths/bounds.ts
- size: function
- cause: an empty path's placeholder rect is treated as real bounds
- confidence: sure

## bendSegmentSymmetric throws on a grip whose subpath doesn't exist, where bendSegment returns false
- where: packages/geom/src/paths/anchorSymmetry.ts:213 (flatOf / bendSegmentSymmetric)
- scenario: a stale grip with `grip.sub` past the last subpath (for example, after an edit dropped a subpath) and a non-empty `syms`. `flatOf` reads `set.anchors[k].length` for every `k < sub` and throws a TypeError on `undefined`. With `syms` empty, the same call goes to `bendSegment`, which returns false through `segmentEnds`. One question, two answers depending on whether a symmetry is active.
- evidence: read
- severity: low
- size: line
- cause: grip not validated before computing a flat index
- confidence: sure

## offsetCornerTraces grows the stored radius, not the setback the corner actually draws
- where: packages/geom/src/paths/cornerOffset.ts:39 (offsetCornerTraces)
- scenario: a corner whose stored radius is clamped by a short edge (`contourCuts` scales `trim` below `want`). `cut.start`/`cut.end` sit at the clamped setback (`inLen`), but the moved trace is built from `spec.radius + d/tan(half)`. So its start and end fall where the offset outline has no cut, `restoreCorners` never matches it, and the corner stays expanded even though the offset draws it whole. The setback to grow is the measured `inLen` (equal to `outLen` between straight edges).
- evidence: read
- severity: low
- size: line
- cause: unclamped spec radius used in place of drawn trim
- confidence: likely

## anchorsToPath re-encodes far-moved anchors in float32 when `like` has no origin
- where: packages/geom/src/paths/anchors.ts:178 (anchorsToPath)
- scenario: `editAnchorSet` on a path near 0 (no origin), with an edit that moves anchors far out, for example `translateAnchorBy` by 1e7. Because `like` is given, the builder neither sets an origin nor calls `autoOrigin`. The result stores coords near 1e7 in a Float32Array, where the spacing between representable values is 1. The fractions are lost, which `autoOrigin` exists to prevent. It should fall back to `autoOrigin` when `like.origin` is undefined.
- evidence: read
- severity: low
- size: line
- cause: autoOrigin skipped whenever `like` is passed
- confidence: likely

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
packages/geom/src/paths/contourSides.ts
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

<!-- done: 5 findings, files read: 38 -->
