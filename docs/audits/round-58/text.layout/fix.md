Shrink-to-fit stroke (A) fixed a857208137→c246ebb99e — final sha **c246ebb99e**: scaled with the text, `bakeTextFit` included, the strict call recorded in `docs/unruled.md`: a `{ px }` width scales too, as `{ px }` `fontSize` already does.

Covered code point in an RTL cluster drawn twice (A) — not a defect: the covered slot does get un-shaped and mirrored, but `drawsInk` stays false, so every painter (`paintRuns`, `textToPath`, `textClusters`) skips it; ran a reproduction and only the cluster's glyph was drawn.

Removed bidi positions get level 0 (A+B) — fixed a3ae38a6ab: they take the level of the kept position they are placed beside, or the paragraph level on a line that keeps none.

Pooled `Line` objects keep the last layout's entries (B) — fixed f7ee403e63.

`JOINED_ENDS` grows without bound (B) — fixed 7c83226a92: capped at 2^16 like its sibling scratches; a longer text builds its own.

Duplicate: "removed positions level 0" B is a duplicate of A's.

Extra: none.

Checks:
- `npx vitest run --maxWorkers=1 packages/text/src/layout/bidiIntegration.test.ts` — pass (23)
- `npx vitest run --maxWorkers=1 packages/text/src/layout/layoutPools.test.ts` — pass (4)
- `npx vitest run --maxWorkers=1 packages/text/src/layout/layoutEntries.pool.test.ts` — pass (3)
- `npx vitest run --maxWorkers=1 packages/text/src/textFit.test.ts` — pass (11)
- `npm run checks:gate` — pass ("checks:gate: all 32 passed")
- `npm run check:changesets` — pass
- `npm run lint -w @weasel-js/text` — not run: `@weasel-js/text` has no `lint` script ("Missing script: \"lint\""); eslint on every changed file instead — pass

tally: 4 of 6 fixed, 0 extra fixed