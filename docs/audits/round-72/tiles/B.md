# Audit round 72 — tiles (blind reviewer)

## A bake answering null counts as baked, so `pending` can read 0 while that tile is still wanted
- where: packages/tiles/src/pyramid.ts:113-119 (TilePyramid.run)
- scenario: `bake` returns null for a tile it has only part-baked (core's `TileBakes.bake` does exactly that until the tile is whole). `baked++` runs regardless, and `pending = order.length - baked + waiting`. When the null tile is the last in `order` (or the only one), `pending` is 0 and `fading` false, so a caller following the `TileFrame.pending` contract ("the caller asks for another frame while any are") stops asking and the tile is never finished; the screen keeps the stand-in until something else wakes it. core's tileHost only escapes this by also checking `l.bakes.inFlight`. A null should leave the key counted in `pending` (and arguably not count toward `baked`).
- evidence: read
- severity: medium

## A floor that alone breaks the byte bound drives the level down to -64
- where: packages/tiles/src/pyramid.ts:99-104 (TilePyramid.run, `fits` loop)
- scenario: `bytesPerTile` set and `floor.length * bytesPerTile > maxBytes` (a big floor or a tight `maxBytes`). `fits()` can never be true because lowering the level only shrinks the on-screen term, so the loop calls `scheme.wanted` ~64+ times per frame and settles on level -64, whose single tile covers 2^64 tile widths: the frame bakes and draws a tile in which the content is invisibly small. The loop should stop once the on-screen term alone is within the bound (or when the screen needs one tile), not chase a term it cannot change.
- evidence: read
- severity: low

## A tile that arrives fading in drops the finer stand-ins it was drawn with a frame earlier
- where: packages/tiles/src/pyramid.ts:188-202 (TilePyramid.drawsFor)
- scenario: zooming out, a level-z tile is missing, so its held level-z+1/z+2 children are drawn over the coarse ancestor. Next frame it is baked with `bornAt = now` (alpha 0): `finerHeld` runs only when `t === undefined`, so the sharp children vanish at once and the screen shows the blurrier ancestor (or nothing, if no ancestor is within `standInLevels` and no floor tile covers it) while the tile fades in. The fade is meant to go from the stand-in to the tile; here it goes from a worse stand-in than the one just shown. The finer draws should continue under a fading tile.
- evidence: read
- severity: low

## Rebaking a tile mid-fade cuts its fade short
- where: packages/tiles/src/cache.ts:68-77 (TileCache.put)
- scenario: a tile arrives at `now` (fading over 160 ms); 50 ms in, an edit dirties it and the hold passes, so it is rebaked. `put` sets `bornAt: -Infinity` for any replacement, so the tile jumps from ~30% to full alpha in one frame — a pop. The doc comment says only a tile replacing a *stale* one skips the fade, but the rule is applied to every replacement and ignores that the replaced tile had not finished fading; carrying `was.bornAt` forward when `was` was still fading would keep the fade.
- evidence: read
- severity: low

## `planeFloor` with `floorTiles = 1` returns up to two tiles a side
- where: packages/tiles/src/scheme.ts:136-141 (planeFloor)
- scenario: `planeFloor(scheme, 512, [100, 100, 700, 700], 1)`: z = floor(log2(512/600)) - 1 = -2, side 2048, span 600 ≤ half a tile, but a box straddling a tile edge (e.g. `[1900, 1900, 2500, 2500]`) meets 2×2 tiles, against the documented "spans at most `floorTiles` tiles a side". The `- 1` assumes one extra tile a side fits in `floorTiles`, which holds for `floorTiles ≥ 2` only; for 1 no level guarantees it, so either the doc or the argument's range is wrong.
- evidence: read
- severity: low

## Files read
packages/tiles/src/cache.ts
packages/tiles/src/index.ts
packages/tiles/src/pyramid.ts
packages/tiles/src/scheme.ts
packages/tiles/src/stream.ts

<!-- done: 5 findings, files read: 5 -->
