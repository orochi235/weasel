# Findings: geom.paths.part1

## writeAnchorField under `syms` applies a `by` handle entry twice when an anchor and its image are both selected
- where: packages/geom/src/paths/anchorFields.ts:93 (writeAnchorField, handle branch)
- scenario: a path with 180° rotational symmetry. Anchors A and B are partners under it, and both are selected. Type `outLength` `{ by: 5 }` with `syms` set. A's out handle goes L → L+5, and `moveHandleSymmetric` also writes B's out handle to L+5 as A's image. The loop then reaches B, reads its already-moved handle (L+5) and adds 5 again, giving L+10, and that image is written back onto A. Both handles end at L+10 when they should be at L+5. `inAngle`/`outAngle` with `by` drift the same way. The x/y branch avoids this: it collects deltas first, and `translateEachSymmetric` moves "an anchor that is itself in `deltas` as asked, not as another's image". The handle branch has no such guard.
- evidence: read
- severity: medium
- fix: packages/geom/src/paths/anchorFields.ts
- size: function
- cause: handle targets are computed one anchor at a time, each after the previous anchor's symmetric images have already landed
- confidence: likely

## offsetCornerTraces builds its probe wedge without an origin, so traces lose float32 precision far from 0
- where: packages/geom/src/paths/cornerOffset.ts:46 (offsetCornerTraces)
- scenario: a path with origin (1e7, 1e7) and a round corner. The wedge is built with `new PathBuilder().moveTo(at.x + …)`, with no `autoOrigin`/`setOrigin`, so its world coordinates are stored raw in a Float32Array, whose spacing near 1e7 is 1 unit. The trace's `start`/`end` from `cornerCuts(withCorner(wedge, …))` are then off by up to about 0.5 units. `restoreCorners` matches traces at a tolerance of 1e-3, so near the origin the offset corners fold back into specs, but far from it they stay expanded. The rest of the package measures from an origin for exactly this reason (`autoOrigin`).
- evidence: read
- severity: medium
- size: line
- cause: PathBuilder without autoOrigin for world-space geometry
- confidence: likely

## offsetCornerTraces resizes from the stored radius, not from the clamped cut the corner actually draws
- where: packages/geom/src/paths/cornerOffset.ts:40 (offsetCornerTraces)
- scenario: a corner whose spec radius is larger than its short edges allow, so `contourCuts` clamps its trim (cut.start/cut.end lie `trim` from the anchor, not `radius`). The new radius is computed as `spec.radius + sign*distance/tan(half)`, and the wedge cuts at that radius. So the trace sits where an unclamped corner would be, not where the offset outline draws the clamped one: it never matches, and the corner stays expanded. `inLen`/`outLen` (the drawn trim) are computed a few lines above but not used for the radius.
- evidence: read
- severity: low
- size: line
- cause: stored radius used in place of the clamped trim
- confidence: likely

## restoreCorners drops a corner spec stored on a closed contour's twin anchor
- where: packages/geom/src/paths/cornerRestore.ts:239 (restoreCorners) / write
- scenario: `result` is `M a L b L c L a Z`, a closing line onto the first point, which the walkers keep as a separate twin anchor at flat 3, with a corner spec at index 3. `contourCuts` honors that spec for anchor 0 via `c.twin`. `restoreCorners` builds `specs` only from `result.corners[c.first + k]` over `c.anchors`, which no longer include the twin. So when another trace folds in and the path is rewritten, the twin's spec is gone. The docstring says "Specs `result` already holds are kept".
- evidence: read
- severity: low
- size: line
- cause: twin index not consulted when collecting existing specs
- confidence: likely

## nearestOpenEnds ignores lone anchors that subpathEndAt and joinSubpathEnds treat as joinable ends
- where: packages/geom/src/paths/joinAnchors.ts:139 (nearestOpenEnds)
- scenario: a set holding an open two-anchor line and a lone point near its end. `subpathEndAt` reports the lone anchor as end `'last'`, and `joinAnchorsAt(line end, lone point)` joins them. But `nearestOpenEnds` skips every subpath with `sub.length < 2`, so a Join that picks the nearest ends returns null, or joins two farther ends instead. The question "is a lone anchor an open end" gets two different answers.
- evidence: read
- severity: low
- size: line
- cause: inconsistent lone-anchor rule between end lookup and nearest-end search
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
