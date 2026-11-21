Distance-range Infinity accepted by `parseBmFont` (B): fixed bff152e71f

Face cap drops by creation order rather than last use (A+B): fixed ab5bc025f2

Invalid weight leaves the previous face's canvas font in place (A): fixed bae9c4c640. The strict call is recorded in `docs/unruled.md`: a finite weight is clamped to 1–1000, and a non-finite one draws at 400 and warns once.

Stale `reclaimSharp` timer fires after a full `reclaim` (B): fixed d29126b7b4. The same guard also stops a field miss and a color miss in one frame from emptying every page twice.

Rooms settle at the first frame after a timer-run reclaim (B): fixed cf0daf7f25

Sharp bake that misses while sharp pages refill is never retried (A+B): fixed 3bece5ce6c

Same sharp miss, as listed in B (B): duplicate of the A+B sharp-retry finding, fixed 3bece5ce6c

Face cap, as listed in B (B): duplicate of the A+B face-cap finding, fixed ab5bc025f2

Checks:
- `npx vitest run --maxWorkers=1 packages/font/src/FontAtlas.test.ts`: pass (10 passed)
- `npx vitest run --maxWorkers=1 packages/font/src/dynamic/dynamicAtlas.test.ts`: pass (32 passed)
- `npx vitest run --maxWorkers=1 packages/font/src/dynamic/sharpColor.test.ts`: pass (11 passed)
- `colorGlyphs.test.ts`, `lateFace.test.ts` and `dynamicAtlas.pbt.test.ts` (related, not touched): pass (17 passed)
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/font`: fail ("Missing script: \"lint\"", because the package has no lint script). In its place, `npx eslint` on every changed `.ts` file: pass (exit 0, no errors)
- `npm run check:changesets`: pass ("OK — 3215 changeset(s)")
- `npm run check:size`: pass. `canvasWeight` lives in `glyphRasterizer.ts` so that `dynamicAtlas.ts` stays under 400 lines.

The tree is clean apart from `.skulkr/`.

tally: 8 of 8 fixed, 0 extra fixed