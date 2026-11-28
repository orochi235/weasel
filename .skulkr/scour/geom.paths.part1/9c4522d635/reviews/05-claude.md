## writeAnchorField applies a handle `by` entry cumulatively across anchors that are images of each other under the symmetries
- where: packages/geom/src/paths/anchorFields.ts:95 (writeAnchorField)
- scenario: a 4-fold rotationally symmetric path, all four anchors selected, `syms` from `anchorSymmetries`, field `outLength` with `{ by: 10 }`. Anchor 0's out handle goes to L+10 and `moveHandleSymmetric` writes that into anchors 1–3. The loop then reads anchor 1's already-moved handle (L+10), adds 10 again, and writes L+20 into every image, and so on. Every out handle ends at L+40 instead of L+10. The same happens for `inX`/`outY`/`Angle` `by` entries, and a `to` entry ends with the last anchor's value and its images, not the typed value on each. The position fields avoid this because they compute every delta first and hand the whole batch to `translateEachSymmetric`, which skips anchors already in `deltas`. The handle path has no such batching.
- evidence: read
- severity: medium
- fix: packages/geom/src/paths/anchorFields.ts, packages/geom/src/paths/anchorSymmetry.ts
- size: function
- cause: per-anchor symmetric write with no skip for partners already written
- confidence: likely

## offsetCornerTraces builds its wedge in float32 with no origin, so traces far from 0 are rounded
- where: packages/geom/src/paths/cornerOffset.ts:47 (offsetCornerTraces)
- scenario: a polygon with a round corner near x = 1e7 (stored with an `origin`). The wedge is built with `new PathBuilder()` without `autoOrigin()`/`setOrigin`, so its coordinates near 1e7 are stored as Float32 with a step of 1 unit. `cornerCuts` on the wedge then reports `start`/`end`/`pieces` that are off by up to about 0.5, while `restoreCorners` matches against `CORNER_RESTORE_TOLERANCE = 1e-3`. The offset corner is never folded back and stays expanded. Near 0 the same shape restores. Every other builder in the area picks an origin (`autoOrigin`, or `setOrigin(path.origin)` in `expand` and `write`).
- evidence: read
- severity: medium
- size: line
- cause: PathBuilder without an origin for world-space points
- confidence: likely

## boundsOfPaths stretches the union to (0, 0) when any path is empty
- where: packages/geom/src/paths/boundsOfPaths.ts:19 (boundsOfPaths)
- scenario: `boundsOfPaths([rect at (1000,1000) 10×10, emptyPolygon])`. `boundsOfPath(empty)` returns `{x:0,y:0,width:0,height:0}`, which is folded into the union, so the result is (0,0)–(1010,1010) instead of (1000,1000)–(1010,1010). This happens for any selection holding an empty path, such as a pen path with no commands yet or a path whose deletions emptied it. Empty paths should be skipped, the way `!any` already treats an empty input.
- evidence: read
- severity: low
- size: line
- cause: empty path's placeholder rect counted as geometry
- confidence: sure

## restoreCorners drops a closing-line "twin" anchor and the corner spec stored on it
- where: packages/geom/src/paths/cornerRestore.ts:251 (restoreCorners / write)
- scenario: `result` has a contour `M0 0 L10 0 L10 10 L0 0 Z` (a closing line ending on the start point, so `decodeContours` pops the end anchor and records `twin`) with its corner spec stored at the twin index, which `contourCuts` reads as anchor 0's corner. If any trace folds anywhere in the path, `write` rewrites every contour. The rewrite uses `specs[k] = result.corners[c.first + k]` and never consults `c.twin`, and it omits the twin anchor. Anchor 0's corner disappears, and the path's anchor count (`countPathAnchors`) drops by one, so per-anchor arrays such as `vertexColors` no longer line up.
- evidence: read
- severity: low
- size: function
- cause: twin spec not carried into the rebuilt contour
- confidence: likely

## bendSegmentSymmetric throws on a grip whose subpath doesn't exist, where bendSegment returns false
- where: packages/geom/src/paths/anchorSymmetry.ts:205 (flatOf, via bendSegmentSymmetric)
- scenario: with `syms` non-empty and `grip.sub >= set.anchors.length + 1` (a stale grip after a deletion dropped a subpath), `flatOf` reads `set.anchors[k].length` for a missing subpath and throws a TypeError. If `grip.sub` equals the subpath count, `ia` falls past the end, `nextFlat` returns -1 and the call returns false. With empty `syms` the same grip returns false from `bendSegment`. So one input gets two different answers depending on whether symmetry is on.
- evidence: read
- severity: low
- size: line
- cause: unvalidated grip before flat-index arithmetic
- confidence: sure

## anchorsToPath with a `like` that has no origin never picks one, so anchors edited far out lose precision
- where: packages/geom/src/paths/anchors.ts:165 (anchorsToPath)
- scenario: a path near 0 (no `origin`) and an edit through `editAnchorSet` that moves an anchor to x = 1e7, for example `writeAnchorField(..., 'x', { to: 1e7 })`. `like` is given and has no origin, so neither `setOrigin` nor `autoOrigin` runs, and the coordinates are stored as raw Float32 with a step of 1. Without `like` the same anchors get an origin from `originFor`.
- evidence: read
- severity: low
- size: line
- cause: origin choice skipped whenever `like` lacks one
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

<!-- done: 6 findings, files read: 38 -->
