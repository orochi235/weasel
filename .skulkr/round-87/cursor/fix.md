The cursor sink leaving an override on the element after its value gets re-serialized (A+B) — fixed a8d109aa1e

The cursor sink clearing a painted override that other code set (B) — fixed b4468cf9f3

`brushRing` drawing the default ring for a negative, NaN or infinite radius (A) — fixed db31ac2cba for the infinite case only. A negative or NaN radius falling to the default is already ruled (unruled.md, 2026-11-10), so not a defect. The throw for an infinite radius is my strict call, recorded in `docs/unruled.md`.

`brushRing(Infinity)` drawing the default ring (B) — duplicate of the A finding above, fixed in the same commit, db31ac2cba

`placeCursorPath` mirroring arc endpoints but not the sweep flag when the scale is negative (B) — not a defect: one negative `k` scales both axes, which is a point reflection (a half turn, determinant k² > 0). Orientation is kept, so the sweep must not flip, and SVG reads a negative radius as its absolute value.

`runs()` accepting `WEASEL_PBT_RUNS=Infinity` (B) — fixed 07b30b2303

[r42-1] The fit guards measuring every halo as half the halo width (carried) — not a defect (no longer applies): `reach()` now measures by role, and a stroke's own width is included.

[r42-2] A marked glyph taking an angle without a rotation check (carried) — fixed d4db695432. `bakeCursor`, `cursorFor` and `resolveCursor` now throw a `RangeError`, on every tier, for an angle step that turns a glyph `rotationFitsInBox` refuses. The marked crosshairs, the eyedropper and the swap all failed that check. Only `resize` and `rotate` are turned anywhere in the tree. This is my strict call, recorded in `docs/unruled.md`.

[r42-3] The bake cache growing without bound (carried) — not a defect (no longer applies): it is now an LRU capped at `CURSOR_BAKE_CACHE_LIMIT`.

[r42-4] The path walk accepting H, V, C, Q, S and T (carried) — not a defect (no longer applies): `walk` now throws on anything outside M, L, A and Z.

[r42-5] The arc bound using the authored radius even when SVG scales it up (carried) — not a defect (no longer applies): it now uses `max(|rx|, half the chord)`.

[r42-6] `markedGlyph` dropping a glyph's own `over` layer (carried) — fixed 9161789d40

[r42-7] A world-unit ring of radius 0 drawing at the default size (carried) — not a defect (no longer applies): `brushRing(0, 'world')` now equals the 1 px ring, ruled 2026-11-24.

Extra (sweep): the baked-hotspot property in `registry.pbt.test.ts` was flaky. At size 1 its expected hotspot was held to the image width rather than the last pixel, as the bake holds it, so some seeds failed — fixed 2b1572563a

Checks:
- Each touched test file, one at a time with `--maxWorkers=1`: cursorSink 14 passed, brushRing 4 passed, pbt.fixture 3 passed, mark 8 passed, resolve 15 passed, bake.pbt 7 passed, resolve.pbt 5 passed, registry.pbt 2 passed.
- Whole cursor package: 22 files, 191 tests passed.
- `npm run checks:gate`: "checks:gate: all 33 passed". The first run failed `check:part-caches` on the new rotation cache in `bake.ts`; I switched it to `createPart` and amended the commit.
- `npm run typecheck:packages -- cursor`: "1/1 cursor ok".
- `npm run lint -w @weasel-js/cursor`: the package has no `lint` script ("Missing script"). The root `npm run lint` inside the gate passed.
- Tree is clean.

tally: 6 of 14 fixed, 1 extra fixed