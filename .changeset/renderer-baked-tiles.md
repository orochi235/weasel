---
'@weasel-js/renderer': minor
---

The renderer bakes commands into tile textures it keeps, and a `tile` command draws one, joining the frame's image runs.

`renderer.tiles.bake(commands, size)` draws commands given in a tile's own texel space into a new texture `size` texels a side and answers its `TileTexture`; `{ kind: 'tile', tile, x, y, width, height, source }` draws it bilinearly. `renderer.tiles.release(tile)` returns its texture to a pool, and `bytes`, `count` and `generation` (which moves when a context loss takes every tile) say what is held.

<!-- entry: new api -->
