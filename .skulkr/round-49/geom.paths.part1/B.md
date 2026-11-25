I couldn't write `.skulk/out/findings.md` (the write permission was declined), so here is the whole findings document.

# Findings: geom.paths.part1 (round 49, blind reviewer)

## isAnchorSmooth counts two handles pointing the same way as smooth, so fairing flips one across the anchor and a handle drag mirrors the other
- where: packages/geom/src/paths/anchors.ts:193 (isAnchorSmooth). It is used by packages/geom/src/paths/fairing.ts:77-98 (fairOne), packages/geom/src/paths/anchorEdits.ts:130-140 (moveHandleTo) and packages/geom/src/paths/bendSegment.ts:45-46.
- scenario: take an anchor at (0,0) with inHandle (10,0) and outHandle (5,0). This is a cusp: both handles are on the same side.
  - The cross product of the two handle vectors is 0, so `isAnchorSmooth` returns true. Its own comment says it is meant to detect handles "on opposite sides of the anchor", but it never checks the sign of the dot product.
  - `fairAnchors` then takes `u` from the out handle and sets `a.inHandle = along(a, u, -nextIn)`. That moves the in handle to negative x, turning the cusp into a smooth point and changing the curve's shape. A corner should have been skipped here.
  - `moveHandleTo(…, breakSmoothness=false)` likewise moves the opposite handle to the far side (`2a − target`).
  - `bendSegment` calls `alignedOpposite` on it.
  - Expected: handles pointing the same way (dot > 0) count as a corner.
- evidence: read
- severity: medium

## growRegion's round join sweeps a near-U-turn the wrong way, so the cap passes through the inside
- where: packages/geom/src/paths/growRegion.ts:104,112 (joinPieces)
- scenario: a corner whose edges reverse direction, so `|cross| < 1e-9` and `dot < 0`, is classed as convex whatever the sign of `cross`. The arc sweep is then `atan2(cross, dot)`, which is ±π depending only on the sign of `cross`, including a signed zero.
  - Example: grow the zero-area line `M 0 0 L 10 0` with `join: 'round'`. Here `sigma = 1`.
  - At the (10,0) end, `cross = +0`, the sweep is +π and the cap bulges out past x = 10. That one is correct.
  - At the (0,0) end, `cross = -0`, the sweep is −π. The arc starts at `nin = (0,1)` and sweeps through (1,0), so the cap bows into the segment instead of out past x = 0.
  - The same happens at any spike vertex where `sigma·cross` is a tiny value of the wrong sign.
  - Expected: a U-turn's sweep is `sigma·π`, always outward.
- evidence: read
- severity: low

## growRegion offsets every contour by one path-wide winding sign, so a separate shape wound the other way shrinks instead of growing
- where: packages/geom/src/paths/growRegion.ts:49 (growRegion)
- scenario: `sigma` comes from the whole path's signed area and is applied to every contour's normals.
  - Example: a path of two separate squares, A (100×100, clockwise) and B (10×10, counter-clockwise). Both fill under `'nonzero'`, because their windings are ±1. This is common in compound paths joined from different sources.
  - `sigma` follows A, so B's normals point inward and B comes out shrunk by `distance` (or inverted, if `distance > 5`) instead of grown.
  - The doc says the call grows "the region `path` fills under `'nonzero'`". A contour's orientation can only stand in for "hole" when it sits inside an opposite-wound contour, so this needs a containment test, not one global sign.
- evidence: read
- severity: medium

## flatAnchorIndices folds an implicit subpath's closing curve against the wrong start point, so its numbering drifts from pathToAnchors' corner numbering
- where: packages/geom/src/paths/cornerCarry.ts:31 (flatAnchorIndices)
- scenario: take a path `M a L b Z L c C … a Z`. Its second subpath opens without an `M`, at the pen position `a`.
  - `pathToAnchors` gives that subpath an implicit start at `a` and folds the closing C onto it. The C's anchor gets no corner index, so the next subpath starts at index k+1.
  - `flatAnchorIndices` instead sets `sx, sy` to the first drawn command's own endpoint, `c`, because the `count === 0` branch uses `ex, ey`.
  - At the Z it sees `ex !== sx` and never folds. The C gets index k+1, and every later subpath's anchors sit one index above how `pathToAnchors` and `PolygonPath.corners` number them.
  - `carryCorners` and `cornerRestore`'s `write` then put specs on the wrong anchors.
  - Expected: on an implicit open, the start is the pen position (`forEachSegment`'s `penX, penY`).
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

<!-- done: 4 findings, files read: 37 -->