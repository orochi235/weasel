- [r42-1] fit guards measure a stroke's halo as half the halo width (carried): fixed ad13d46f52. This also moved the marked crosshair's offset from 3 to 2 units, so its arms' halo now fits in the box.
- [r42-2] a marked glyph takes an angle but is never checked for rotation (carried): fixed fcdbf7fae4. My call, recorded in `docs/unruled.md`: `resolveCursor` paints such a spec, and `bakeCursor`/`cursorFor` throw a `RangeError` unless the new `clip: true` is passed.
- [r42-3] the bake cache's key takes any size and fallback, so it is unbounded (carried): fixed 7cc35a2844. The cache now keeps the 256 most recently used cursors.
- [r42-4] the path walk accepts absolute H, V, C, Q, S and T (carried): not a defect (no longer applies). `walk` throws for anything outside M/L/A/Z, it is tested in `types.test.ts`, and the pending changeset `cursor-fit-guard-dialect.md` covers it.
- [r42-5] the arc bound uses the authored radius when SVG scales it up (carried): fixed e040290288.
- [r42-6] markedGlyph drops the glyph's own `over` layer (carried): fixed 6dd9df15cd.
- [r42-7] a world brush ring of radius 0 draws at the 24 px default (carried): fixed f1e76f4d85. My call, recorded in `docs/unruled.md`: it now draws the one-pixel ring that `brushRing(0)` draws.

Extra defects:
- rotation fit bounded an arc by its circle's bounding square rather than by the circle (sweep): fixed ad13d46f52, folded into r42-1. With the corrected stroke margins, the old bound would have wrongly rejected the `rotate` glyph.

Checks:
- `npx vitest run --maxWorkers=1 packages/cursor packages/core/src/canvas/paintedCursorLayer.test.ts`: pass (21 files, 183 tests). After the final amend, `packages/cursor` alone: pass (172 tests).
- `npm run checks:gate`: pass (all 32 passed). An earlier run failed `check:part-caches` on a hand-rolled WeakMap in `bake.ts`; I replaced it with `createPart` and amended the commit.
- `npm run lint -w @weasel-js/cursor`: not run, because the package has no `lint` script. Instead, `npx eslint packages/cursor/src packages/cursor/scripts`: pass, and the gate's `npm run lint`: pass.
- `npm run check:changesets`: pass.
- No browser tests were touched. The tree is clean.

tally: 6 of 7 fixed, 1 extra fixed