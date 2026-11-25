# Audit round 67 — geom.paths.part1

## anchorsToPath numbers corner specs by decoded anchor, but a re-encode can fold one away, shifting every later spec
- where: packages/geom/src/paths/anchors.ts:191 (anchorsToPath), against foldClosingCurve at :134 and flatAnchorIndices in cornerCarry.ts:27
- scenario: a closed subpath `[A, B, C]` where the user drags or snaps C exactly onto A, with B→C curved (C has an inHandle) and a straight close (no A.inHandle, no C.outHandle). anchorsToPath writes `M A, C…, C…→C(=A), Z` and `corners = [A, B, C, sub1[0], sub1[1], …]`. Every reader folds that closing curve (`foldClosingCurve` when decoding, and `flatAnchorIndices` does `flat--`), so the next subpath starts at flat 2 instead of 3. sub1[0] then reads C's spec, sub1[1] reads sub1[0]'s, and so on, and the last spec goes past the end. The corners should stay on the anchors they were set on. Either the writer has to number specs by the indices a reader will see, or the encode has to avoid producing a fold the model didn't contain.
- evidence: read
- severity: medium

## editAnchorSetTracked maps a reversed subpath's handle points to the wrong side
- where: packages/geom/src/paths/anchorOrigins.ts:179,191 (editAnchorSetTracked), with joinAnchors.ts:204 (reverseInPlace)
- scenario: `joinSubpathEnds` joins two `'first'` ends, which reverses subA in place and keeps each anchor object "so origin tracking still recognizes them". `byAnchor.get(a)` then returns the anchor's old `Held`, which has `in` = the old in-handle's point index and `out` = the old out-handle's. After the reversal, though, the anchor's inHandle sits where its old outHandle was. When `origins` is built, `code % 3 === 1` (the in handle) maps to `held.in`, which is the control point on the other side of the anchor. So per-point values carried with `remapPointValues` (skin weights) swap between the two controls of every anchor on the reversed run. The doc's own rule is that "a subpath turned around keeps its weights", and `copied` does follow handles by position. Only the `reversed` flag on the anchor's own point is set; the handles get no correction.
- evidence: read
- severity: medium

## deleteAnchorsAt drops untouched lone-point subpaths, and refuses a deletion because of them
- where: packages/geom/src/paths/anchorEdits.ts:258-289 (deleteAnchorsAt)
- scenario: a path `M 0 0` (a lone point, decoded as a 1-anchor subpath) plus a triangle. Deleting one triangle anchor also removes the lone-point subpath, because the final pass drops every subpath under 2 anchors whether or not this deletion touched it. Second case: a lone point plus a 2-anchor line, deleting one line anchor. `survivors` counts 0, so the whole deletion is refused even though the lone point would remain. The doc says only subpaths "left with fewer than two anchors" by the deletion are dropped.
- evidence: read
- severity: low

## asPolygonPath stores a far-out rect as raw float32 world coords with no origin
- where: packages/geom/src/paths/builder.ts:182-190 (asPolygonPath)
- scenario: `asPolygonPath(rectPath(1e7 + 0.3, 5e6 + 0.7, 10.25, 4.5))` puts `rectToContour`'s Float64 world coords straight into a `Float32Array`. At 1e7 the float32 spacing is 1, so the corners snap to whole units and a 10.25-wide rect comes back 10 or 11 wide. Every other constructor in this file goes through `PathBuilder().autoOrigin()` for this reason (the file header says so). The rect should be measured from an `originFor` origin.
- evidence: read
- severity: low

## outsideSide returns null for a closed contour drawn as one curve, so growRegion grows that hole the wrong way
- where: packages/geom/src/paths/contourSides.ts:45-51 (outsideSide), used by growRegion.ts:71
- scenario: a ring whose inner contour is a single closed cubic loop (`M p C c1 c2 p Z`; pathToCubicContours adds no closing edge since it ends on p). The longest segment is picked by chord length, which is 0 for this segment, so `seg` stays undefined and the function returns null. growRegion then falls back to the path-wide `sigma` instead of the hole's own side: when the outer contour sets the overall sign, the hole is offset outward rather than closed in. Picking by control-polygon length, or falling back to the longest segment with any length, would find a side.
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
