# Audit round 79 — tiles

## A tile that arrives already stale is left out of the frame's `stale` list
- where: packages/tiles/src/pyramid.ts:213 (drawsFor `mark`), with packages/tiles/src/cache.ts:89 (TileCache.put sets `drawnAt: frame`)
- scenario: a bake answers null in frame N (`defer`), an edit meets the tile (inFlight `dirtiedAt` set), and in frame N+2 the bake answers a payload. `arrive` puts it through `cache.put`, which stamps `drawnAt = frame`, then marks it stale. In `drawsFor` the tile is drawn on screen, but `mark` pushes to `stale` only when `t.drawnAt !== frame`, which is already false. So `TileFrame.stale` ("Stale tiles drawn on screen this frame") omits a stale tile that is on screen. It should be listed like any other stale tile drawn that frame.
- evidence: read
- severity: low

## An ancestor stand-in that is still fading in is drawn at full alpha, and the frame does not report `fading`
- where: packages/tiles/src/pyramid.ts:227-230 (drawsFor, the coarse `anc` push)
- scenario: the view zooms in a level. On-screen tile A is missing, and its parent P is baked in the same frame as a level-above extra (`bakeOrder`'s `extra`), or was baked a frame or two earlier, so `now - P.bornAt < fadeMs`. Before this, A's spot showed P's own ancestor (or nothing). `drawsFor` pushes P with `alpha: 1`, ignoring `fadeOf(P)`, and leaves `fading` unset for it, so P appears all at once over the coarser stand-in. Own tiles and finer stand-ins do fade. A stand-in that is mid-fade should be drawn at its fade alpha over whatever was there before, and the frame should report `fading`.
- evidence: read
- severity: low

## Dirty padding rounds away far from the origin, so a tile touching an edit's edge is not marked stale
- where: packages/tiles/src/cache.ts:37-45 (tileMeets)
- scenario: at the deepest level `levelFor` allows (`exactLevel`: tile index up to 2^50), a texel is `s / tilePx` world units, so a coordinate can be as much as 2^59 texels from the origin (with tilePx 512). That is past 2^52, so `box[i] - padTexels / texelsPerUnit` rounds back to `box[i]`. An edit whose box max lies on a tile boundary (for example a shape's bounds on a tile edge, padded 1 texel for antialiasing bleed) then fails `boxesMeet` against the neighboring tile, because the test excludes touching edges. That neighbor keeps its pre-edit pixels. Near the origin the same edit dirties it. The pad should be at least one ulp of the coordinate, or the test should count a touching edge when `padTexels > 0`.
- evidence: read (arithmetic from `exactLevel` and `tileMeets`; not run)
- severity: low

## Files read
packages/tiles/src/cache.ts
packages/tiles/src/index.ts
packages/tiles/src/pyramid.ts
packages/tiles/src/scheme.ts
packages/tiles/src/stream.ts

<!-- done: 3 findings, files read: 5 -->
