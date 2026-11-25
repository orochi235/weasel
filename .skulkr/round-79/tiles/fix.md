A stale tile that arrives late (A+B) — fixed 35df6d9a22. A deferred bake that came back after an edit met it was drawn on screen but was missing from `stale` and not counted in `pending`. The `stale` list now dedupes by tile id instead of `drawnAt`, and a tile that arrives stale counts as unfinished, so it is pending.

A coarser stand-in still fading in was drawn at full alpha (A) — fixed ad360b086c. A stand-in that is mid-fade now draws at its fade alpha over the next held tile above it, and the frame reports `fading`.

The dirty pad rounded away far from the origin (A) — fixed 3d9de54347. `tileMeets` now grows each edge by at least one ulp when the pad is not zero.

A stale tile that arrives late (B) — duplicate of the first finding (A).

Extra: none. 7830ec9bf4 only shortens two changeset titles from the fix commits to under 140 characters.

Checks:
- `npx vitest run --maxWorkers=1 packages/tiles/src/pyramid.test.ts` — pass (24/24)
- `npx vitest run --maxWorkers=1 packages/tiles/src/cache.test.ts` — pass (3/3)
- `npm run checks:gate` — pass ("checks:gate: all 33 passed")
- `npm run check:changesets` — pass ("OK — 1006 changeset(s), 52 with warnings", none of the warnings on the tiles changesets)
- `npm run lint -w @weasel-js/tiles` — not run: the package has no `lint` script. `npx eslint packages/tiles/src` passed with no output.

tally: 3 of 4 fixed, 0 extra fixed