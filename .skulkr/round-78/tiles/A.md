## planeFloor's hair for a zero-length side grows with the coordinate, so a line far from the origin pins hundreds or more floor tiles
- where: packages/tiles/src/scheme.ts:141 (planeFloor)
- scenario: bounds `[1e15, 0, 1e15, 1]` (a vertical line of length 1 at x = 1e15), tilePx 512, floorTiles 2. span = 1, so z = 9 and a tile is 1 unit a side. The zero-width x side is widened by `max(|1e15|, 1) * 2^-40` ≈ 909 units, so `keysMeeting` returns about 910 tiles on x by 1 on y. They are all pinned as the floor, never evicted, and all baked before anything on screen. At x = 1e18 that is about 900k tiles, and `Math.min(...floor.map(...))` in `TilePyramid.run` (pyramid.ts:141) then overflows the stack. It should return at most `floorTiles` a side. The hair needs to be bounded by the tile side at `z` (for example `min(side / 2, a few ulps of box[i])`), not scaled by `|box[i]|`.
- evidence: read
- severity: medium

## keysMeeting never ends once a tile index passes 2^53
- where: packages/tiles/src/scheme.ts:76 (createPlaneScheme → keysMeeting), reached from `wanted` and `TilePyramid.run`
- scenario: a `tiledLayer` with no `maxLevel` (it is optional and `tileHost.ts:99` passes it through as undefined), zoomed deep: pxPerUnit = 2^62 at x ≈ 1. Then z = 62 and side = 512 / 2^62, so `x0 = floor(1 / side)` ≈ 2^53. At that size `x++` no longer changes `x` once it reaches a value whose ulp is ≥ 2, so `for (x = x0; x <= x1; x++)` spins forever and the frame hangs. Farther from the origin it happens at shallower zoom: at x ≈ 1e6, from about z = 45. It should either refuse levels whose indices are not exact integers (draw live, as past `maxLevel`) or clamp the level.
- evidence: read
- severity: low

## Files read
packages/tiles/src/cache.ts
packages/tiles/src/index.ts
packages/tiles/src/pyramid.ts
packages/tiles/src/scheme.ts
packages/tiles/src/stream.ts

<!-- done: 2 findings, files read: 5 -->
