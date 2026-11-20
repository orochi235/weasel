The findings file couldn't be written (permission was denied for `.skulk/out/findings.md`), so the full document is below. All six findings come from reading the code; I ran no tests.

# Findings: geom.booleans (round 49)

## Booleans on straight-line paths fill the overlap of contours that partly overlap, ignoring the fill rule
- where: packages/geom/src/booleans/adapter.ts:198 (groupRings), reached from ops.ts:41 (boolean)
- scenario: Take a polygon path with no curves, `fillRule: 'evenodd'`, made of two squares that partly overlap, (0,0)–(10,10) and (5,5)–(15,15). The same happens under nonzero when the two squares wind opposite ways. A fill of it leaves the overlap empty. `cutPaths` returns null whenever no input has a curve, so `pathUnion`, `pathIntersect`, `pathSubtract`, `pathExclude`, `pathTrim` and `pathMerge` all go to the clipper. `groupRings` only nests rings by containment: neither square contains the other, so both are "filled" top-level rings and become two separate polygons. polygon-clipping unites the polygons of one MultiPolygon, so the overlap comes back filled. Give one edge a curve and `curveBoolean` answers correctly, because `windingSet` honors the fill rule, so the same shape gets two different answers. The knife inherits this: `resolveBoundaries` (splitBySegment.ts:96) settles crossing contours with `pathUnion(path)`.
- evidence: read
- severity: high

## contoursIntersect reports every path with two or more contours as self-crossing
- where: packages/geom/src/booleans/contours.ts:104 (contoursIntersect)
- scenario: The skip for a contour's wrap-around neighbors tests the global edge index (`i === 0`) where it should test the edge's own index (`e.i === 0`), so the skip only works for the first contour. In every later contour, the first and last flattened edges share the start point, and `segmentsCross` counts a shared end as a crossing (one side is 0 and the other isn't). So a donut, or two separate squares, returns true. `resolveBoundaries` (splitBySegment.ts:95) then runs `pathUnion(path)` before every knife cut on such a path. Its own option doc says only paths whose contours actually cross get that union. Where `curveBoolean` declines (near-tangent curves, more than 4096 segments), the union flattens, and the knife's pieces lose their curves although nothing crossed. Combined with the finding above, this also sends straight-line even-odd paths through the wrong union.
- evidence: read
- severity: medium

## When curveBoolean declines, the fallback flattens curves at a fixed 0.5 units whatever the input's size
- where: packages/geom/src/booleans/ops.ts:41 (boolean), and ops.ts:179 (pathTrim) → adapter.ts:57 (pathToMultiPolygon)
- scenario: Every fallback calls `pathToMultiPolygon(p)` with no options, so the tolerance is `DEFAULT_FLATTEN_TOLERANCE = 0.5` in path units. `curveFaces` scales its tolerance to the input instead (`extent * 1e-5`). Take two unit-radius circles that touch internally, so `coverEdges` returns null and `pathUnion` falls back. Each quarter-arc cubic flattens to one chord, and the union comes back as roughly a square. The same inputs at 100× scale come back smooth. The flattening tolerance is decided one way here and another way in curveFaces.
- evidence: read
- severity: medium

## snipPathByPolyline counts a crossing at a closed cutter's first point twice and then drops it
- where: packages/geom/src/booleans/cutCrossings.ts:19 (cutPosition), used by splitBySegment.ts:200 (snipStations), which `snipPathsAtCrossings` reaches
- scenario: `cutPosition` lets segment 0 take s = 0 and the last segment take s = 1, which is right for an open cut. A closed cutter, though, ends where it starts: `cutLinesOf` closes it, and a rect cutter starts at its (x, y) corner. A path crossing it exactly there is detected on both segments, once at s = 0 and once at s = n. `snipStations` then sees two detections at one point and treats them as a touch (even count), so the crossing is not cut. Example: `snipPathsAtCrossings([line from (-1,-1) to (1,1), rect at (0,0) 4×4])` leaves the line uncut at (0,0). Depending on rounding, the crossing can also be detected zero times.
- evidence: read
- severity: low

## pathFaceArrangement treats a covered sliver face as uncovered when it lists neighbors
- where: packages/geom/src/booleans/curveFaces.ts:242 and :271 (curveFaces, neighborsOf)
- scenario: Cycles with `area <= minArea` are skipped, so their `faceOf` stays -1. `neighborsOf` reads -1 as "covered by no input". So a sliver of covered area between two faces reports both faces as neighbors of the uncovered side (`a: -1`), and they are not reported as neighbors of each other. `FaceArrangement.neighbors` documents `a = -1` as meaning the other side is covered by no input.
- evidence: read
- severity: low

## flattenTolerance: 0 drops straight cubics from the face arrangement
- where: packages/geom/src/booleans/curveFaces.ts:56 (chords)
- scenario: Call `pathFaceArrangement(paths, { flattenTolerance: 0 })` (a negative value or NaN does the same). For a cubic whose second differences are all 0 (a straight cubic with evenly spaced controls), `(d·(d−1)·0)/(8·0)` is NaN. `Math.max(1, NaN)` and `Math.min(1024, NaN)` both stay NaN, so `flatten`'s loop pushes no chords and that segment disappears from the outline. Its faces then merge with their neighbors or leak. Curved segments get 1024 chords. The tolerance is not checked or clamped anywhere.
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
packages/geom/src/booleans/snipAtCrossings.ts
packages/geom/src/booleans/splitBySegment.ts
packages/geom/src/booleans/trianglesToPath.ts
packages/geom/src/booleans/vertexFans.ts

<!-- done: 6 findings, files read: 31 -->