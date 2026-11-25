A re-wanted tile whose aborted load is still settling never loads (A+B): fixed 0f3411550d

A `load` that throws synchronously leaks a concurrency slot (A+B): fixed 39dfdca552

`pending` leaves out stale tiles waiting out their one-frame hold (A): fixed 17b4d823ea

`stale` lists a stand-in ancestor once per spot it covers (A+B): fixed 2da9af3d45

The floor stops standing in past `standInLevels` (A): fixed 210c97d989

Every whole-tile draw shares one mutable `source` array (B): fixed b090554c1a

`TileCache.put` releases the old payload even when the new one is the same object (B): fixed 4b5e4e73f5

`planeFloor`'s `tilePx` can disagree with its scheme (B): fixed a1575b4ee8. This was a strict call: it now throws a `RangeError` on a mismatch, and the call is recorded in `docs/unruled.md`. Dropping the parameter instead would break every caller.

`planeFloor` returns no tiles for zero-extent content on a tile edge (B): fixed a8cff113f7

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/tiles/src/stream.test.ts`: pass (7)
- `npx vitest run --maxWorkers=1 packages/tiles/src/pyramid.test.ts`: pass (13)
- `npx vitest run --maxWorkers=1 packages/tiles/src/cache.test.ts`: pass (1)
- `npx vitest run --maxWorkers=1 packages/tiles/src/scheme.test.ts`: pass (2)
- `npx vitest run --maxWorkers=1 packages/core/src/core/layers/tileHost.test.ts`: pass (5)
- `npm run check:changesets`: pass
- `npm run checks:gate`: pass (all 33 passed, including `npm run lint`)
- `npm run lint -w @weasel-js/tiles`: not run, because the package has no `lint` script. The root `npm run lint` inside the gate passed.

tally: 9 of 12 fixed, 0 extra fixed