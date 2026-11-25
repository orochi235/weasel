# Audit round 84, geom.booleans

## An even-odd path whose rings meet, when the cut declines, falls back to an XOR that fills a single ring's self-overlap by nonzero
- where: packages/geom/src/booleans/ringFill.ts:79 (resolveRingFill)
- scenario: an `evenodd` path whose flattened rings meet and that `cutContours` declines (more than 4096 flattened edges, which a flattened glyph run reaches easily, or a winding mismatch in `coverEdges`). The fallback wraps each ring as its own polygon and calls `clipper.xor`. That XOR gets parity right between rings, but `polygon-clipping` reads each ring by nonzero (`if (windingsAfter[i] === 0) continue; // non-zero rule`, polygon-clipping.esm.js:831). So a ring that winds twice around a region (a loop drawn round twice, or a figure with a doubly-wound lobe) comes back filled there, where even-odd leaves it empty. The fallback should resolve each ring's own even-odd parity as well, for example by going through `contourFaces` as the nonzero branch does and keeping the faces with odd winding.
- evidence: read (fallback code, and polygon-clipping's per-ring winding test at dist/polygon-clipping.esm.js:816-835)
- severity: medium

## orientBoundaries probes at an absolute 1e-9 floor with no magnitude term, so a small shape far from the origin loses its contours
- where: packages/geom/src/booleans/contours.ts:151 (orientBoundaries)
- scenario: `eps = Math.max(extentOf(contours) * 1e-6, 1e-9)` has no term for the coordinates' magnitude. Take a path held through `origin` in doubles at x ≈ 1e10 (ulp ≈ 2e-6) with an extent of 1. Then eps = 1e-6, and `p.x ± tan.y * eps` rounds to the same point or to a neighbor across the contour. The `left` and `right` probes come out equal, the contour is treated as bounding nothing, and it is dropped. `splitPathByPolyline` then returns `null` or loses pieces. Other probes in this area were given a `16 * Number.EPSILON * magnitude` floor (`arrangeLines`, `polishCrossings`); this one was not. `coverEdges`' probe (`extent * 1e-7`, curveBoolean.ts:68) has the same gap, but there it only pushes the boolean onto the flattened fallback.
- evidence: read (inference from float spacing; not run)
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

<!-- done: 2 findings, files read: 32 -->
