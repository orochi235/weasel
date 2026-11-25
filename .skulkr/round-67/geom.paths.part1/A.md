# Audit round 67 — geom.paths.part1 findings

## Kept anchors whose handles an edit swaps in place get their handle origins swapped
- where: packages/geom/src/paths/anchorOrigins.ts:179 and :191 (editAnchorSetTracked); trigger in packages/geom/src/paths/joinAnchors.ts:204 (reverseInPlace)
- scenario: `joinSubpathEnds` with `a.end === 'first'` (or `b.end === 'last'`) reverses a subpath with `reverseInPlace`. That keeps each anchor object so origin tracking "still recognizes them", and swaps `inHandle` and `outHandle` on each one. `editAnchorSetTracked` finds those objects in `byAnchor` and reports the point written for the new in-handle as `held.in`, which is the index of the old in-handle. That handle now sits where the old out-handle was. `remapPointValues` therefore carries a skin weight kept per point onto the wrong handle of every anchor in the reversed run: the in and out weights trade places. The `reversed` flag goes only on the anchor's own point, and no handle origin is corrected. The `copied` path, used for anchors that come back as new objects, matches handles by position for exactly this case ("so a subpath turned around keeps its weights"). The kept-object path does not, so the two paths answer the same question two different ways. Expected: the new in-handle's origin is the old out-handle's point, and the other way round.
- evidence: read (traced `byAnchor.get(a) ?? copied(...)` and the `code % 3` handle lookup against `reverseInPlace`)
- severity: medium

## Knead misses a long segment that passes under the brush between probe samples
- where: packages/geom/src/paths/kneadPath.ts:99 (underBrush), used by refine at :80
- scenario: `underBrush` tests only the 13 points at `t = k/12`. A straight segment is evaluated as the cubic `(a, a, b, b)`, which runs fastest in the middle, so neighboring probes there sit about L/8 apart. Take an edge from (0,0) to (1000,0), with the brush centered at (560,0) and radius 30. The nearest probes land at x≈500 and x≈624, both more than 30 away. `underBrush` returns false, so the segment is never split, and neither end anchor is within the radius, so nothing moves: the dab returns `path` unchanged while the brush sits on the outline. The docstring promises that "a long straight edge bends where the brush meets it". Expected: measure the segment's true distance to the brush center (nearest point on the segment or curve) instead of a fixed sample count.
- evidence: read (probe positions from smoothstep 3t²−2t³ at t=6/12 and 7/12)
- severity: medium

## deleteAnchorsAt drops untouched single-anchor subpaths
- where: packages/geom/src/paths/anchorEdits.ts:284 (deleteAnchorsAt)
- scenario: For `M0 0 L10 0 L20 0 M50 50`, `pathToAnchors` decodes `[[a,b,c],[d]]`. Deleting flat index 1 passes the survivor check, because sub 0 keeps 2 anchors. The cleanup loop then removes every subpath with fewer than 2 anchors, including sub 1, which held none of the deleted indices. A stray point the user never selected disappears, and every flat index after it shifts. Expected: drop only the subpaths this deletion reduced below two.
- evidence: read
- severity: low

## A corner on the first anchor of a subpath closed by an explicit `L` back to its start is never cut
- where: packages/geom/src/paths/cornerSegments.ts:94 (closeContour), with packages/geom/src/paths/corners.ts:49-54 (contourCuts)
- scenario: `M a L b L c L a Z` is a common way an imported polygon is written. `closeContour` folds only a closing *curve*, so this contour keeps a duplicate anchor `a'` at `a` and appends a closing line of zero length from `a'` to `a`. In `contourCuts`, anchor 0's in-segment is that zero-length line, so `tangentAt` returns null and the cut is null. Anchor 3 (`a'`) has the zero-length line as its out-segment, which also gives null. A corner spec on that point therefore never draws, from either index, and `cornerFrames` offers no frame there. Every other vertex of the triangle rounds and this one stays sharp. Expected: skip a zero-length closing segment (fall back to the previous real segment's tangent), or fold a coincident closing line the way a closing curve is folded.
- evidence: read (the input form and its frequency in imports are inferred, not checked against the SVG importer)
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
