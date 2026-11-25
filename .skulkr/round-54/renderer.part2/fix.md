- tile `size` that is fractional gets a truncated raster tile with seams, and drifts from the SVG export (A+B): fixed ad5a2d8c1f
- `patchBounds` samples an 8×8 grid, so it under-bounds a bowed edge and the bake crops the bulge (A): fixed 98551a9397
- `textCommand`, `textCommandFromRuns` and `textCommandFromRunsInto` pass tile and image paints through unresolved, so that text draws nothing (A): fixed c4ab8fdda0
- a text layer's cached box never sees a face land or a text engine register, so it is culled or clipped on stale bounds (A+B): fixed a98e2ff920
- `registerPaintDrawKind` that throws on a program with no source leaves the programs registered before it in place (A): fixed c9cdb9c855
- a `'bounds'` linear gradient on a non-square box tilts its bands differently from SVG's `objectBoundingBox` (A): fixed ffd2f01510. `paintToLocalUnits` and `paintToBoundsUnits` now move a diagonal gradient's `to`, so gradient handles show and commit the point the bands actually use. Because of that I updated the expected values in three existing tests: `commandPaint.test.ts`, `SceneGradientHandles.test.tsx` and `fromKit.trim.test.ts`.
- `retainBudget`'s stated overshoot of 36 MiB at 4x leaves out the single-sampled scratch buffer (A): fixed 9ec32dcdb0 (the docs now say 44 MiB)
- `keepKey` keeps effect uniform arrays by reference, so a write in place to one still matches the stale surface (A+B): fixed b002457a1e
- a `chunks` tile has no bound on its scatter count, so a tiny `chunkSize` or a huge `density` hangs the resolve (B): fixed 46f90639e2. This needed a behavior call: the scatter is now capped at one chunk per pixel of the tile. I recorded it in `docs/unruled.md` under a new section, "Audit round fifty-four (2026-11-20): renderer, part two".

Extra: none.

Checks:
- Each touched test file run alone with `npx vitest run --maxWorkers=1`, all pass:
  - `tileGeometry.test.ts` 7/7
  - `meshPaint/surface.test.ts` 15/15
  - `textCommand.test.ts` 21/21
  - `textBounds.test.ts` 2/2
  - `paintKinds.programs.test.ts` 5/5
  - `paintToLocalUnits.test.ts` 17/17
  - `patterns/commandPaint.test.ts` 7/7
  - `SceneGradientHandles.test.tsx` 10/10
  - `svg/src/fromKit.trim.test.ts` 16/16
  - `retain/retainedKey.test.ts` 1/1
  - Also run, untouched: `paintToLocalUnits.pbt.test.ts` 4/4, `retainedKey.pbt.test.ts` 3/3, `meshPaint/bake.test.ts` pass, and `svg` `unpack`, `fromKit`, `gradients`, `bakedScale`, `markerCommands`, `NodeShape`, `derivedPath`, `apps/draw` `svgInterop` all pass.
- The new tests for the tile-size, mesh-bounds, text, text-layer, paint-kind and uniform fixes fail on the unfixed code (the mesh one I worked by hand rather than ran). The `chunks` test I did not run against the old code, since it would hang.
- `npm run checks:gate`: first run failed 5 of 32: `typecheck`, `check:part-caches`, `check:proto-index`, `typecheck:packages` and `lint`. All were in my new code; I fixed them and folded each fix into its commit. Second run: `checks:gate: all 32 passed`.
- `npm run check:changesets`: `OK — 2598 changeset(s).`
- `npm run lint -w` for `@weasel-js/renderer`, `@weasel-js/ui-canvas` and `@weasel-js/svg`: `Missing script: "lint"`. None of the three has a lint script; root `lint` passed inside the gate.
- No browser test files touched. Tree clean, `.skulk/` untouched.

tally: 12 of 12 fixed, 0 extra fixed