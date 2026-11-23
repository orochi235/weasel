planeFloor's reach past a line of no width grew with the coordinate (A): fixed 9073a8ca18

keysMeeting loops forever once a tile index passes 2^53 (A): fixed 62e2954a2d. The plane scheme now stops at the deepest level where every tile index is an exact integer, and `keysMeeting` throws a `RangeError` for a box whose indices aren't. This is a strict call, recorded in `docs/unruled.md` (c596a5e3fb).

An infinite `pxPerUnit` gives an `Infinity` level, which hangs `run` (B): fixed 745e0e4f0b. The pyramid now draws live at any level that isn't finite. The plane scheme also clamps such a level to a finite one (62e2954a2d).

Byte-bound coarsening steps past a scheme's top level and leaves the screen blank (B): fixed eb115af8ba

Finer stand-ins are drawn at full alpha while still fading in (B): fixed bf394ad989

An edit made while a deferred bake is in flight is lost (B): fixed 3637ee1b81. The pyramid tracks bakes that answered `null`, holding no more of them than the cache's count limit. `dirty`/`dirtyAll` mark those bakes, and the payload is stored stale when it arrives. The cache's box test is now one shared `tileMeets` helper.

Extra: none. 68ab34a9ae only shortens my own changeset titles to under 140 characters.

Checks:
- `npx vitest run --maxWorkers=1 packages/tiles/src/scheme.test.ts`: pass (8/8)
- `npx vitest run --maxWorkers=1 packages/tiles/src/pyramid.test.ts`: pass (22/22)
- `npx vitest run --maxWorkers=1 packages/tiles/src/cache.test.ts`: pass (2/2)
- `npx vitest run --maxWorkers=1 packages/tiles/src/stream.test.ts`: pass (8/8)
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w @weasel-js/tiles`: not run, because the package has no `lint` script. `npx eslint packages/tiles/src` ran instead: pass (exit 0)
- `npm run check:changesets`: pass ("OK — 904 changeset(s)", none of the warnings are from tiles changesets)

tally: 6 of 6 fixed, 0 extra fixed