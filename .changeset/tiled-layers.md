---
'@weasel-js/core': minor
---

A canvas layer can be kept as a tile pyramid, so a zoom over a heavy, mostly still layer draws tiles instead of drawing the layer again.

`<SceneCanvas tiles={{ backdrop: {} }}>` tiles a scene layer, whose tiles go stale only where an edit moved something; `tiles: TileOptions` on a `RenderLayer` tiles a consumer layer, staled when its `deps` move. Options are `tilePx` (512), `maxLevel`, `floorTiles` (2), `fadeMs` (160), `bounds` and `damage`. A frame bakes under a shared budget, a coarser tile standing in for one not yet baked.

<!-- entry: rank=10 new api perf -->
