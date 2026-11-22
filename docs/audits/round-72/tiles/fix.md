Byte-bound downshift ignores the ring and the level above, so ring tiles are evicted and rebaked every frame (A): fixed 033775ede2

Throwing `release` or `onError` skips `done()` and holds a load slot forever (A): fixed 7a9bd31368

`planeFloor` with `floorTiles` 1 returns two tiles a side (A): fixed b85b26caba. It now throws a `RangeError` for a `floorTiles` under 2, with no override. I recorded that call in `docs/unruled.md`, and core's `floorTiles` doc now says "at least 2".

A null bake counts as baked, so `pending` can read 0 while that tile is still wanted (B): fixed 353b27cc72

A floor that alone breaks the byte bound drives the level down to -64 (B): fixed 59880d78bf. The level now drops only while a coarser one puts fewer tiles on screen.

A tile fading in drops the finer stand-ins it was drawn over a frame earlier (B): fixed 8072d4f4a0

Rebaking a tile mid-fade cuts its fade short (B): fixed 76c1f28b89. A rebake now keeps the replaced tile's `bornAt`.

`planeFloor` with `floorTiles = 1` returns up to two tiles a side (B): duplicate of A's `planeFloor` finding, fixed b85b26caba

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/tiles/src/pyramid.test.ts`: pass (17)
- `npx vitest run --maxWorkers=1 packages/tiles/src/cache.test.ts`: pass (2)
- `npx vitest run --maxWorkers=1 packages/tiles/src/scheme.test.ts`: pass (4)
- `npx vitest run --maxWorkers=1 packages/tiles/src/stream.test.ts`: pass (8)
- `npx vitest run --maxWorkers=1 packages/core/src/core/layers/tileHost.test.ts`: pass (5)
- `npx vitest run --maxWorkers=1 packages/core/src/core/layers/tileSplit.test.ts`: pass (5)
- `npm run check:changesets`: pass ("OK — 553 changeset(s).")
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w @weasel-js/tiles` and `npm run lint -w @weasel-js/core`: not run, because neither package has a `lint` script (npm answered "Missing script"). The root `npm run lint` passed inside the gate.

tally: 8 of 8 fixed, 0 extra fixed