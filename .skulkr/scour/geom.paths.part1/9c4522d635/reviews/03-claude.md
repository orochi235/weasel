## offsetCornerTraces builds its probe wedge with no origin, so traces far from 0 lose float32 precision and never restore
- where: packages/geom/src/paths/cornerOffset.ts:47 (offsetCornerTraces)
- scenario: a rounded-corner polygon at x ≈ 1e7, offset by some distance → the wedge `new PathBuilder().moveTo(...).lineTo(...)` is stored as raw float32 coords (step 1.0 at 1e7), so `cornerCuts` of it reports `start`/`end`/`pieces` up to ~0.5 units off the true offset corner; `restoreCorners` then compares against CORNER_RESTORE_TOLERANCE (1e-3) and leaves every such corner expanded. Every other builder in the area uses `autoOrigin()` or the source origin for this reason.
- evidence: read
- severity: medium
- size: line
- cause: PathBuilder without origin far from 0
- confidence: likely

## bendSegmentSymmetric throws on a grip naming a subpath past the end, where bendSegment returns false
- where: packages/geom/src/paths/anchorSymmetry.ts:213 (flatOf, via bendSegmentSymmetric)
- scenario: `bendSegmentSymmetric(set, { sub: set.anchors.length, segIdx: 0, t: .5 }, dx, dy, syms)` with non-empty `syms` (a grip kept from before a subpath was deleted) → `flatOf` reads `set.anchors[k].length` for an undefined `k` and throws TypeError; with `syms = []` the same call returns false via `bendSegment`/`segmentEnds`. `flatOf` duplicates `flatAnchorIndex` in anchorEdits, which returns -1 for this case.
- evidence: read
- severity: low
- fix: packages/geom/src/paths/anchorSymmetry.ts
- size: function
- cause: duplicate flat-index helper without range check
- confidence: sure

## writeAnchorField under symmetry applies handle writes anchor by anchor, so selected partners overwrite or compound each other
- where: packages/geom/src/paths/anchorFields.ts:96 (writeAnchorField)
- scenario: a 4-fold rotationally symmetric circle (syms = the three rotations), all four anchors selected, `writeAnchorField(set, [0,1,2,3], 'outX', { by: 10 })` → anchor 0's write sets anchor 1's out handle to the rotated image; anchor 1's write then adds 10 to that already-moved handle and re-images it onto anchor 0, so each handle ends up moved by a sum of rotated deltas rather than by 10 in x (with `{ to }` the last anchor written wins and the others end at its images). The x/y branch avoids this by collecting deltas into one `translateEachSymmetric` call where "an anchor itself in deltas moves as asked"; the handle branch has no equivalent.
- evidence: read
- severity: low
- size: function
- cause: per-anchor symmetric writes not collected
- confidence: likely

## restoreCorners drops a corner spec stored on a closed contour's twin anchor when it rewrites the path
- where: packages/geom/src/paths/cornerRestore.ts:248 (restoreCorners → write)
- scenario: `result` has two contours; contour A is closed with its last anchor on its first and a straight close (decodeContours records `twin`), and its corner spec sits at the twin index (contourCuts honors it: `cornerAt(path, c.twin)`); contour B has a trace that folds. `specs` is read only at `c.first + k` for the kept anchors, and `write` emits A without the twin, so A's corner is lost from the rewritten path even though nothing touched A.
- evidence: read
- severity: low
- size: function
- cause: twin index ignored when collecting specs
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

<!-- done: 4 findings, files read: 38 -->
