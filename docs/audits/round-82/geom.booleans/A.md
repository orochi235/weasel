## A self-crossing cubic whose two crossing parameters lie on the same side of t = 0.5 is not cut at its crossing
- where: packages/geom/src/booleans/curveEdges.ts:94 (selfCrossing)
- scenario: `selfCrossing` splits the cubic at t = 0.5 and only looks for crossings between the left and right halves. A cubic can have its loop's two parameters both in (0.5, 1) or both in (0, 0.5). For example, take a looped cubic with its crossing at (0.2, 0.8) and restrict it to [0.15, 1.5], which gives about (0.04, 0.48). The crossing then lies inside one half, so `l` and `r` meet only at their shared point and the function returns null. `unlooped` keeps the segment whole, and `nearPairs` never tests a ref against itself, so `cutEdges` puts no vertex at the crossing. One edge then runs through the crossing, while `coverEdges` classifies it from its midpoint alone. The traced loops come out self-crossing, with wrong cover on half of that edge. `pathUnion`/`pathIntersect` etc. return a wrong curved result instead of declining to the clipper, which the ops.ts header says is what happens for self-crossing cubics.
- evidence: read
- severity: medium

## Knife: an untouched hole belonging to an island is handed to the traced piece around it
- where: packages/geom/src/booleans/splitBySegment.ts:138 (knife) / packages/geom/src/booleans/cutRegions.ts:11 (assembleRegions)
- scenario: Take an annulus (outer O, hole H) with an island I inside H, and the island has its own hole J. A chord crosses O only, slicing off part of the ring without reaching H. O becomes traced loops; H, I and J stay untouched. `assembleRegions(loops, [H, J])` gives each hole to the smallest *traced* region whose sampled outline contains its midpoint. It never considers the untouched island I, so J goes to the big piece along with H. That piece is then outer CCW + H CW + J CW, so the winding inside J is −1 and the area is filled under the nonzero output. The leftover piece is `I` alone, since J was taken, so it fills J solid too. J should be a hole of I and not part of the traced piece at all.
- evidence: read
- severity: medium

## pathToMultiPolygon: a nonzero path whose rings cross falls back to nesting by containment when the cut declines, which misreads crossing rings
- where: packages/geom/src/booleans/ringFill.ts:67 (resolveRingFill) → packages/geom/src/booleans/adapter.ts:137
- scenario: A nonzero path holds a CCW ring A and a CW ring B that overlap partway, meant to punch a hole across A's edge, and the flattening has more than 4096 segments (`MAX_SEGMENTS`, so `cutContours` returns null), or `curveRegions` declines. `resolveRingFill` then returns null, and `groupRings` nests by containment. B's box is not inside A's, so B becomes its own polygon, filled because its winding is −1. The clipper unions A and B, so the overlap, which has winding 0 and should be empty, comes out filled. Every boolean and `trianglesToPath`-independent caller of the flattening fallback gets the wrong region for large nonzero paths with crossing rings. Only evenodd has a fallback (xor).
- evidence: read (polygon-clipping applies nonzero per ring, checked in node_modules)
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
