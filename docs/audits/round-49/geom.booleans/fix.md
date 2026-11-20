contoursIntersect counts every contour after the first as crossing itself at its closing vertex (A): fixed c72f47a5dc

Face arrangement merges vertices at a billionth of the largest coordinate, so small shapes far from the origin collapse (A): fixed cda3ce9a41. The same magnitude-scaled tolerance appears in `meshJunctions` and in the clipper's retry grid, but both are deliberate there (they absorb float32 storage error, which grows with the coordinate), so I left them alone.

Straight-line booleans fill the overlap of partly overlapping contours, ignoring the fill rule (B): fixed f12d3f27f7. Rings that touch or cross are now resolved by the path's fill rule, through the same cut machinery `curveBoolean` uses, before they are nested. This also fixes the knife's union of such paths.

contoursIntersect reports every path with two or more contours as self-crossing (B): duplicate of A's contoursIntersect finding, c72f47a5dc

Clipper fallback flattens curves at a fixed 0.5 units whatever the input's size (B): fixed a0f3413c0e. Both fallbacks (`boolean` and `pathTrim`) now flatten at a ten-thousandth of the inputs' extent, capped at 0.5.

snipPathByPolyline counts a crossing at a closed cutter's first point twice and drops it (B): fixed 64d8098218

pathFaceArrangement reports a face's edge along a dropped covered sliver as bordering uncovered space (B): fixed 7e8ee0d892

`flattenTolerance: 0` drops straight cubics from the face arrangement (B): fixed f74477d83f. Strict call: a value that is not a positive finite number throws a `RangeError`. Recorded in `docs/unruled.md` under "Audit round forty-nine".

No extra defects.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: contours.test.ts pass, snipAtCrossings.test.ts pass, pathFaceArrangement.test.ts pass, pathOps.test.ts pass, adapter.test.ts pass, curveBoolean.test.ts pass, curvePieces.test.ts pass, faceArrangement.test.ts pass, pieces.test.ts pass, splitBySegment.test.ts pass, trianglesToPath.test.ts pass, ops.pbt.test.ts pass, ops.laws.pbt.test.ts pass, geom openFill.test.ts pass, cornerRestore.test.ts pass, pathOriginReaders.test.ts pass, stroke offsetPath.test.ts pass, editing geometryContract.test.ts pass
- `npm run checks:gate`: pass ("all 32 passed", after shortening seven changeset titles that `check:changesets` had refused)
- `npm run lint -w @weasel-js/geom`: unrun. geom has no `lint` script (only `test` and `build`), and the hook refused the command. The root `npm run lint` passed inside the gate.

Tree clean.

tally: 7 of 8 fixed, 0 extra fixed