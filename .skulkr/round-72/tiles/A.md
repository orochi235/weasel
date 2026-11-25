# Audit 72 — tiles

## The byte-bound downshift ignores the ring and the level above, so a tight `maxBytes` evicts and rebakes them every frame and `pending` never reaches 0
- where: packages/tiles/src/pyramid.ts:100 (run, `fits`), with packages/tiles/src/pyramid.ts:117,123 and packages/tiles/src/cache.ts:73,128
- scenario: `bytesPerTile` set, with the screen at 12 tiles, the ring at 18, the level above at about 6 and the floor at 4. `fits` checks only `2·onScreen + floor` = 28 tiles against `maxBytes`. Take `maxBytes` anywhere from 28 to 39 tiles' worth: the level is not lowered, but `bakeOrder` still bakes the level above and the ring. `put` stamps each newly baked tile `drawnAt: frame`, so the ring tiles baked this frame survive this frame's `trim`. On the next frame they are the least recently drawn and get evicted to make room for the next ring bakes. They are wanted again, rebaked, and evicted again. `pending` stays above 0 every frame, so tileHost keeps owing frames (tileHost.ts:139): the frame loop never goes idle and the bake budget is spent forever on tiles that are thrown away. The check should count every tile it schedules (ring and level above included), or the planner should stop scheduling ring and level-above bakes the byte bound cannot keep.
- evidence: read (reasoned through the code path; not run)
- severity: medium

## A throwing `release` or `onError` callback skips `done()`, so the load's entry stays in `loading` and holds a concurrency slot forever
- where: packages/tiles/src/stream.ts:124-135 (pump)
- scenario: the caller's `release` throws while freeing a payload that arrived after its load was aborted (line 126), or while `trim` frees tiles (line 147, reached from line 129), or `onError` throws (line 133). The promise handler exits before `done()` runs. `loading` keeps the id, `inFlight` stays raised, and `pump` is never called again for that slot. After `maxConcurrent` of these, the stream never starts another load. That id is also skipped by every later `update`'s queue, which leaves out anything in `loading`. `done()` should run in a `finally`.
- evidence: read
- severity: low

## `planeFloor` can return two tiles a side when `floorTiles` is 1, although its doc promises at most `floorTiles`
- where: packages/tiles/src/scheme.ts:137 (planeFloor)
- scenario: `floorTiles = 1`. Then `z = floor(log2(tilePx/span)) − 1`, so the tile side is at least 2·span, and a box that straddles a tile edge still meets 2 tiles on that axis, up to 4 tiles in all. The "one less level" step only buys straddle room when `floorTiles ≥ 2`. Either the doc should say the bound is `max(floorTiles, 2)`, or 1 should be rejected.
- evidence: read
- severity: low

## Files read
packages/tiles/src/cache.ts
packages/tiles/src/index.ts
packages/tiles/src/pyramid.ts
packages/tiles/src/scheme.ts
packages/tiles/src/stream.ts

<!-- done: 3 findings, files read: 5 -->
