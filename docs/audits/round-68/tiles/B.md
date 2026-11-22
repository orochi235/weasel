# Audit round 68 — tiles

## A tile re-wanted while its aborted load is still settling is dropped, and never loads unless update() runs again
- where: packages/tiles/src/stream.ts:83-87 (update), 114-117 (pump)
- scenario: the view pans away from tile T, so `update` aborts T's load. The entry stays in `loading` until it settles. The view pans back before it settles, and `update` rebuilds `queue`, filtering out T because `this.loading.has(id)` is still true. When the aborted load settles, its payload is released (the abort flag is set), even when the source ignored the signal and returned a good payload. `done()` deletes the entry and pumps, but T is in neither `queue` nor `held`. If the view then holds still and the caller makes no further `update` calls, T stays blank forever. It should either un-abort, or re-queue T when the aborted load settles, if T is still wanted at the last update.
- evidence: read
- severity: medium

## A load() that throws synchronously leaves its entry in `loading` forever, using up a slot of the concurrency cap
- where: packages/tiles/src/stream.ts:109-114 (pump)
- scenario: `load` is a plain function, not an `async` one, and it throws before returning a promise (bad key, URL build error). `this.loading.set(id, …)` has already run, so the throw escapes `update()` and nothing ever deletes the entry. The tile is never retried, because the queue filter skips ids in `loading`, and `onError` is never called. With `maxConcurrent` 4, four such throws stop the stream permanently. The call should be wrapped so a sync throw takes the rejection path.
- evidence: read
- severity: low

## `TileFrame.stale` lists the same stand-in tile once per on-screen tile it covers
- where: packages/tiles/src/pyramid.ts:172-175, 185-188 (drawsFor, mark)
- scenario: after a zoom-in, 16 on-screen tiles are missing and all stand in on one held ancestor that an edit marked stale. `mark(anc)` runs for each of the 16, so `stale` holds that ancestor's key 16 times. A caller that schedules or counts rebakes from `stale` (doc: "Stale tiles drawn on screen this frame") sees 16 where there is 1. It should push each tile once, e.g. skip when `t.drawnAt === frame` was already set before marking.
- evidence: read
- severity: low

## Every whole-tile draw shares one mutable `source` array
- where: packages/tiles/src/pyramid.ts:170-171 (drawsFor, `whole`)
- scenario: every `own` and `fine` draw in a frame gets the same `unit` Float64Array as its `source`. `readonly source` only stops reassignment, not element writes. A consumer that insets the source in place for one draw (e.g. half-texel inset against bleeding, `d.source[0] += eps`) changes the source of every other whole-tile draw in that frame. Coarse draws get fresh arrays from `subRect`, so the two paths behave differently.
- evidence: read
- severity: low

## Replacing a tile releases the old payload even when the new payload is the same object
- where: packages/tiles/src/cache.ts:68-73 (put)
- scenario: a bake reuses the existing tile's texture: it reads `pyramid.cache.get(id).payload`, redraws into it and returns it. `put` calls `drop(was)`, which calls `release(was.payload)` and frees the texture just returned, then stores the freed payload as the live tile. It should skip the release when `was.payload === payload`.
- evidence: read
- severity: low

## planeFloor takes tilePx separately from the scheme it is given, so the two can disagree
- where: packages/tiles/src/scheme.ts:129-134 (planeFloor)
- scenario: `createPlaneScheme(256)` is paired with `planeFloor(scheme, 512, bounds)` (the default tile size, or a copy that drifted). The level is computed for 512-px tiles but its keys come from the 256-px scheme, so the floor spans twice as many tiles a side as `floorTiles` promises. The scheme does not expose its `tilePx`, so the same value has to be answered in two places.
- evidence: read
- severity: low

## planeFloor returns no tiles for a zero-width or zero-height content box lying on a tile edge
- where: packages/tiles/src/scheme.ts:66-72 (keysMeeting via planeFloor)
- scenario: the content is a vertical line, bounds `[512, 0, 512, 800]`. `span` is 800 > 0, so a level is chosen, but `keysMeeting` gives `x0 = floor(512/s)` and `x1 = ceil(512/s) - 1 = x0 - 1` when 512/s is an integer, so the result is empty. The pyramid then has no floor, and nothing stands in for missing tiles. When the same line is off a tile edge, it gets one column.
- evidence: read
- severity: low

## Files read
packages/tiles/src/cache.ts
packages/tiles/src/index.ts
packages/tiles/src/pyramid.ts
packages/tiles/src/scheme.ts
packages/tiles/src/stream.ts

<!-- done: 7 findings, files read: 5 -->
