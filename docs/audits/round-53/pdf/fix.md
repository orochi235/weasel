Faked-bold TypeError (A) — fixed 4d5d5ba8f7
Non-finite opacity drew an image, sprites, an isolated group or a raster fully opaque (A) — fixed 89388f9bfe. The same `< 1` check sat in `writeShadedFill` for gradients and is fixed in the same commit, so these are now dropped and reported the way a path is.
Texture pattern memo keyed only on the texture id (A) — fixed 26609b6440
Solid stroke on a path with no commands wrote `S` with no current path (B) — fixed 42ea84aee2
One non-finite text in a `text-layer` dropped the whole layer (B) — fixed b434dc6ed1
Once a face runs out of spare codes, a glyph's next reading silently reused its first reading's code (B) — fixed c8d2346a05. This was my call: such a glyph now has no code and is drawn as an outline. It is recorded in `docs/unruled.md`.

No extra defects found beyond the gradient case above.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: `fonts/embedFont.test.ts` 18 passed, `groupOps.test.ts` 20 passed, `images.test.ts` 17 passed, `shading.test.ts` 10 passed, `strokeOps.test.ts` 16 passed, `textOps.test.ts` 23 passed.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed typecheck on a test fixture I wrote; I fixed it and folded the fix into its commit.
- `npm run lint -w @weasel-js/pdf`: pdf has no `lint` script. I ran `eslint` on every changed pdf file instead: passed, no output.
- `npm run check:changesets`: "[changesets] OK — 2543 changeset(s)".
- I briefly ran `git stash` on my own uncommitted source changes to confirm the new tests failed without the fix. I applied and dropped that entry by SHA right away; the stash list is empty and the tree is clean.

tally: 6 of 6 fixed, 0 extra fixed