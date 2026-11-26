Sink restores a painted override it replaced (A): fixed e340eacf27

`bakeFallback` refuses `image-set(…)` images and hotspots like `+4` or `1e1` (A): fixed c5743bc6dc

A world-unit brush ring with a huge finite radius overflows to Infinity at draw (A): fixed 936322bff5. The strict call is in `docs/unruled.md`: `brushRing(r, 'world')` and `resolveCursor` throw a `RangeError` when the drawn size at a zoom of 1 overflows.

A finite world radius whose drawn size overflows is accepted (B): duplicate of A's world-radius overflow finding (936322bff5)

`brushRing` draws a NaN or negative px radius at the 24 px default (B): not a defect. `docs/unruled.md` (cursor audit 87) rules that a negative or NaN radius still falls to the default.

Fit guards treat a circular arc with a negative radius as elliptical (B): fixed 449d632acf

[r42-1] Fit guards measure a stroke path's halo as half the halo width (carried): not a defect (no longer applies). `reach()` gives a stroke `(width + CURSOR_HALO_WIDTH) / 2`.

[r42-2] A marked glyph accepts an angle but is never checked for rotation (carried): not a defect (no longer applies). `resolveCursor` and `cursorFor` both check the marked glyph through `cursorGlyph(glyph, { mark })` and `rotationStep`.

[r42-3] The bake cache is unbounded (carried): not a defect (no longer applies). `cursorFor` keeps the most recent `CURSOR_BAKE_CACHE_LIMIT` (512) entries and drops the oldest.

[r42-4] The path walk accepts absolute H, V, C, Q, S and T and mis-measures H and V (carried): not a defect (no longer applies). `walk` throws on anything outside M, L, A and Z.

[r42-5] The arc bound uses the authored radius when SVG scales it up (carried): not a defect (no longer applies). `r = Math.max(Math.abs(rx), half)`.

[r42-6] `markedGlyph` drops the glyph's own `over` layer (carried): not a defect (no longer applies). It now keeps and shifts the glyph's `over` paths before the mark's.

[r42-7] A world ring of radius 0 draws at the 24 px default (carried): not a defect (no longer applies). Radius 0 in world units now takes the px path and draws the one-pixel ring.

No extra defects.

The sink fix adds public API, `PaintedCursorState.getOverride()`, so its changeset is `minor` and tagged `fix api`. Every implementation in the tree comes from `createPaintedCursorState`, so nothing else needed changing.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: `cursorSink.test.ts` pass (17), `paintedCursorState.test.ts` pass (3), `bake.test.ts` pass (19), `brushRing.test.ts` pass (6), `resolve.pbt.test.ts` pass (5), `types.test.ts` pass (14). `resolve.test.ts`, `bake.pbt.test.ts` and `bake.shrunk.test.ts` were run in one invocation with `brushRing.test.ts` and `resolve.pbt.test.ts`: pass (40).
- `npm run check:changesets`: pass ("OK — 1489 changeset(s)"); none of my changesets has a warning.
- `npm run checks:gate`: pass ("checks:gate: all 33 passed").
- `npm run lint -w @weasel-js/cursor`: not run. The cursor package has no `lint` script; the root `npm run lint` inside the gate passed.
- The tree is clean apart from `.skulkr/`.

tally: 4 of 13 fixed, 0 extra fixed