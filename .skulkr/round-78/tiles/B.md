# Audit round 78 — tiles

## An infinite `pxPerUnit` hangs `run`: the level becomes `Infinity`, which default `maxLevel` does not catch, and `keysMeeting` loops forever at a tile side of 0
- where: packages/tiles/src/scheme.ts:76 (levelFor), packages/tiles/src/scheme.ts:64 (keysMeeting); packages/tiles/src/pyramid.ts:97 (run)
- scenario: a view whose `pxPerUnit` overflows to `Infinity` (zoom so large the scale overflows), box `[10, 10, 20, 20]`, no `maxLevel`. `levelFor` answers `Math.ceil(Infinity)` = `Infinity`, and `level > maxLevel` is `Infinity > Infinity`, which is false, so the view is not drawn live. `wanted(view, Infinity)` calls `keysMeeting` with `side = tilePx / 2**Infinity = 0`. Then `x0 = y0 = floor(10/0) = Infinity` and `x1 = y1 = ceil(20/0) - 1 = Infinity`, so `for (let y = Infinity; y <= Infinity; y++)` never ends and keeps pushing keys until memory runs out. What should happen: a non-finite level is treated as past `maxLevel` (draw live) or as no tiles, never as a loop.
- evidence: read
- severity: medium

## The byte-bound coarsening can step past a scheme's top level and leave the screen blank
- where: packages/tiles/src/pyramid.ts:108 (run, coarsening loop)
- scenario: a scheme with a top level, where `parentOf` returns null at level 0 and `wanted(view, -1)` returns `[]` (a cube-face or volume scheme), with `bytesPerTile` set and `maxBytes` too small even for level 0's screen plus floor. At level 0, `m = shown([]) = 0 < n`, so the loop moves to level -1 with nothing wanted. The frame then has no draws and `pending: 0`, so nothing is drawn at all, where it should keep the coarsest level that has tiles (break when `m === 0`). The plane scheme always has at least one tile, so it never hits this; the scheme interface allows it.
- evidence: read
- severity: low

## Finer stand-ins are drawn at full alpha even while they are still fading in, so they pop
- where: packages/tiles/src/pyramid.ts:200 (drawsFor, finerHeld visit)
- scenario: the view is at level L+1 and its tiles have just been baked (`bornAt` = now, alpha about 0.1). The user zooms out to L within `fadeMs`. Each missing L tile draws its held L+1 children through `finerHeld` with `alpha: 1`, so those children jump from 0.1 to fully opaque in one frame. The `own` path computes alpha from `bornAt`; the stand-in path does not, so the two paths give the same tile different fades.
- evidence: read
- severity: low

## An edit made while a deferred bake is in flight is lost: the tile arrives marked fresh
- where: packages/tiles/src/cache.ts:73 (put), packages/tiles/src/pyramid.ts:131 (run bake loop), packages/tiles/src/cache.ts:94 (dirty)
- scenario: a caller whose `bake` starts asynchronous work, answering `null` until it finishes (the contract counts this as `unfinished` and asks again). Frame F: `bake(k)` starts and returns null. Before F+1, the content under `k` changes and `pyramid.dirty(box)` is called; `k` is not held, so nothing is marked. Frame F+2: `bake(k)` returns the payload rendered from the old content, and `put` stores it with `stale: false`. The tile then shows the pre-edit content until some later edit touches it. What should happen: damage that meets a tile whose bake is still pending is remembered, and the tile arrives stale (or the pending bake is restarted).
- evidence: read (inferred from the `null` contract; no caller checked)
- severity: low

## Files read
packages/tiles/src/cache.ts
packages/tiles/src/index.ts
packages/tiles/src/pyramid.ts
packages/tiles/src/scheme.ts
packages/tiles/src/stream.ts

<!-- done: 4 findings, files read: 5 -->
