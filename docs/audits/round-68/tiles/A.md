# Audit round 68 — tiles

## A tile re-wanted while its aborted load is still settling is never loaded until another update
- where: packages/tiles/src/stream.ts:83-87 (TileStream.update) and :110-113 (pump's done)
- scenario: update(viewA) starts loading tile T; update(viewB) aborts T (its entry stays in `loading` until it settles, by design); update(viewA) again before T's load settles: T is wanted, but `this.loading.has(id)` keeps it out of `queue`, and the abort is not undone. T's load then settles as aborted, its payload is released, `done` deletes the entry and pumps — but T is not in the queue. If the view now holds still (no further `update`), T is never loaded and its spot stays empty. Should: re-queue (or un-abort) a wanted id whose in-flight load is aborted, or have `done` re-queue an aborted id that the last update wanted.
- evidence: read
- severity: medium

## A `load` that throws synchronously leaks a concurrency slot forever
- where: packages/tiles/src/stream.ts:109-114 (TileStream.pump)
- scenario: a non-async `load` implementation throws (bad key, URL builder error) instead of returning a rejected promise. `this.loading.set(id, …)` has already run, `.then` is never reached, so the entry is never deleted; the exception propagates out of `update`. Each such throw permanently consumes one of `maxConcurrent` slots and the id is never re-queued (it is "loading"); after 4 the stream loads nothing. `onError` is never called. Should: wrap the call (`Promise.resolve().then(() => load(...))` or try/catch) so a sync throw takes the rejection path.
- evidence: read
- severity: low

## `pending` omits stale tiles waiting out their one-frame hold, so a frame can report nothing owed while stale tiles still need a rebake
- where: packages/tiles/src/pyramid.ts:119 (TilePyramid.run), :132-137 (needs)
- scenario: `dirtyAll()` (or `dirty`) between run f and run f+1 sets `dirtiedAt = f`. Run f+1: `needs` answers null for every such tile (`f < f` is false), so none is in `order`; if nothing is missing on screen, `pending` is 0 and `fading` false. The frame's doc says the caller asks for another frame "while any are" pending, so a caller following it stops, and the stale tiles are drawn stale indefinitely. The core consumer (packages/core/src/core/layers/tileHost.ts:139-155) only sets `owes` for these via the draw-through branch, which is skipped when the stale set exceeds `DRAW_THROUGH_SHARE` of the screen — exactly the `dirtyAll` case (`depsMoved`). Should: count stale-on-screen tiles awaiting their hold in `pending` (or a separate "owes a frame" flag).
- evidence: read
- severity: medium

## `stale` lists a stand-in ancestor once per spot it covers
- where: packages/tiles/src/pyramid.ts:172-175, :185-188 (drawsFor's `mark`)
- scenario: one stale coarse tile stands in for N missing on-screen spots; `mark(anc)` runs N times and pushes `anc.key` N times (likewise a fading tile marked twice is not, but ancestors are). tileHost counts `frame.stale` (`editing.length`) against `onScreen * DRAW_THROUGH_SHARE`, so duplicates inflate the count and can wrongly skip the draw-through, and the clip union is built from repeated bounds. Should: push a tile's key once per frame (e.g. only when `drawnAt !== frame` before setting it).
- evidence: read
- severity: low

## The floor stops standing in once the view is more than `standInLevels` below it
- where: packages/tiles/src/pyramid.ts:185, :203-213 (ancestorHeld)
- scenario: floor pinned at level z (content fits ~2 tiles a side); with `maxLevel` left at Infinity the user zooms in 9+ levels quickly (one wheel fling). Every on-screen tile is missing, and `ancestorHeld` gives up after 8 parents, so nothing is drawn under them — the empty spots the floor (doc: "so something can always stand in") exists to prevent. Should: fall back to the floor tile containing the spot when the bounded search finds nothing.
- evidence: read
- severity: low

## Files read
packages/tiles/src/cache.ts
packages/tiles/src/index.ts
packages/tiles/src/pyramid.ts
packages/tiles/src/scheme.ts
packages/tiles/src/stream.ts

<!-- done: 5 findings, files read: 5 -->
