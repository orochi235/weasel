# Audit round 82 — geom.booleans findings

## knife assigns an untouched hole of an untouched island to the cut piece around it, filling the hole
- where: packages/geom/src/booleans/splitBySegment.ts:139 (knife), with packages/geom/src/booleans/cutRegions.ts:11 (assembleRegions)
- scenario: a path with outer A, hole B inside it, island C inside B, hole D inside C (a target of nested rings). A short cut crosses only A's outer wall (a corner), so B, C and D are all untouched. `assembleRegions(loops, untouched holes)` only offers the traced loops as homes, so D is placed in the traced A-piece that geometrically contains it, beside B. `leftover` then excludes D (it is already in a traced region) and holds only C. Result: the A-piece carries holes B and D; under nonzero D's winding is +1 −1 −1 = −1 (filled), under evenodd it is 3 crossings (filled), so the A-piece fills D's area; and the island piece C comes back with no hole, also filling D. Expected: D stays a hole of C, and the A-piece has only B.
- evidence: read
- severity: medium

## cyclesOf takes shoelace area on absolute coordinates, so pieces far from the origin get wrong signs and outside cycles
- where: packages/geom/src/booleans/faceCycles.ts:52 (cyclesOf)
- scenario: `twice += xs[u]*ys[v] - xs[v]*ys[u]` on raw coordinates. A circle of radius 0.01 at (1e6, 1e6) through `pathFaceArrangement`: each term is ~1e12 with an ulp ~1e-4, over ~500 chords, against a true area ~3e-4. The sign of a cycle's area, which picks each piece's outside cycle (least area) and the `minArea = 1e-12·extent²` sliver test in curveFaces, becomes rounding. Wrong outside cycle → windings seeded on the wrong face, faces missing or holes misplaced. `polyline.ringSignedArea` already recenters on the first vertex for exactly this; this copy does not, so the same question is answered two ways.
- evidence: read
- severity: medium

## groupRings orients rings by an uncentered shoelace, so small rings far from the origin nest with the wrong winding
- where: packages/geom/src/booleans/adapter.ts:143 (ringSignedArea, used by groupRings)
- scenario: same cancellation as above: the local `ringSignedArea` multiplies absolute coordinates. A nonzero path with a small hole ring (tolerance-flattened, a few units across) at x ≈ 1e7 can get the hole's orientation sign flipped; `groupRings` then sums it as +1 under its parent and treats the hole as filled (merged), so the boolean loses the hole. `polyline.ringSignedArea` recenters; this duplicate does not.
- evidence: read
- severity: low

## curveFaces caps a segment at 1024 chords, silently breaking a caller's flattenTolerance
- where: packages/geom/src/booleans/curveFaces.ts:54 (chords)
- scenario: `pathFaceArrangement(paths, { flattenTolerance: 1e-6 })` on a cubic arc ~100 units across: the bound wants sqrt(6·100/8e-6) ≈ 8660 chords, gets 1024, so the flattening strays ~7e-5 — 70× the tolerance the option documents. `polishCrossings` is then handed `tol` as the chords' error and computes `moveLimit` from it, so correct polishes are rejected as too far. The option should either be honored or rejected, not quietly exceeded.
- evidence: read
- severity: low

## polishCrossings' Newton tolerance ignores coordinate magnitude, so nothing far from the origin is ever polished
- where: packages/geom/src/booleans/crossingPolish.ts:150 (polishCrossings; eps = extent * 1e-12)
- scenario: shapes of extent 1 placed at (1e6, 1e6): eps = 1e-12, but evaluating a curve there carries rounding ~ulp(1e6) ≈ 1e-10, so `solve` never reaches |A − B| ≤ eps and returns null; every crossing stays where the flattening put it, unlike the same shapes at the origin. `arrangeLines` already folds magnitude into its tolerance (`16·EPSILON·magnitude`); this one does not.
- evidence: read
- severity: low

## clipper's coarsest snap grid is coarser than float32, contrary to its stated bound
- where: packages/geom/src/booleans/clipper.ts:15 (GRIDS)
- scenario: the last grid is `size · EPS` with `EPS = 1e-6` (scalar.ts), while float32 resolves ~6e-8 of a value; the header says this grid is "below float32 storage resolution". When the two finer grids also throw, every vertex is moved by up to 5e-7·size, ~8 float32 ulps, so distinct float32 vertices can merge and thin features collapse in the retry's output.
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

<!-- done: 6 findings, files read: 32 -->
