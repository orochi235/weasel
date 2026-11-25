## resolveRingFill's even-odd fallback fills a self-overlapping ring by nonzero
- where: packages/geom/src/booleans/ringFill.ts:76 (resolveRingFill)
- scenario: an `evenodd` path whose flattened rings meet, where `cutContours` declines (over `MAX_SEGMENTS` = 4096 flattened edges, e.g. a curved star or a doubly wound circle flattened at the default tolerance; or `coverEdges`/`traceLoops` declining). The fallback hands each ring to `clipper.xor` as its own operand. Xor is even-odd only *across* operands: inside one operand polygon-clipping applies nonzero per ring (`afterState`, `if (windingsAfter[i] === 0) continue; // non-zero rule`, node_modules/polygon-clipping/dist/polygon-clipping.esm.js:831). So a single pentagram-shaped ring, or a ring wound twice round, comes back with its center (winding 2) filled, where even-odd leaves it empty.
- evidence: read (ringFill.ts and polygon-clipping's afterState)
- severity: medium

## groupRings can loop forever when two rings share every vertex
- where: packages/geom/src/booleans/adapter.ts:204 (groupRings, depth loop `for (let a = i; a >= 0; a = parent[a])`)
- scenario: `ringContains` decides nesting by an even-odd ray cast at three sample vertices, and its result at a vertex depends only on the ring's segment set, not its order. Two rings with the same vertices in opposite order (a face's hole and the neighboring face's outer loop) therefore get the same per-vertex answers, and both can collect 2 of 3 votes: for a 6-vertex ring L1 L2 L3 R1 R2 R3 whose left-side vertices test inside, samples 0, 2, 4 give L1 L3 R2 in one order and L3 L1 R2 from the reversed ring starting at L3. Each is then the other's smallest-box container (equal boxes, smaller than the enclosing outer), so `parent[a] = b` and `parent[b] = a`, and the winding walk never reaches -1. This input arrives through `resolveRingFill`'s nonzero fallback (`contourFaces(...).faces.flatMap(face => face.loops)`, ringFill.ts:79): for a nonzero ring that overlaps itself, the winding-1 face's hole and the winding-2 face's outer loop share their vertices. The result is a hang in `pathToMultiPolygon`, and so in every polygon-clipper boolean on such a path. This rests on reading the code; I have not run it.
- evidence: read (traced by hand)
- severity: medium

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
