---
'@weasel-js/tiles': minor
---

New package: `@weasel-js/tiles`, tile pyramids over any space, with a bounded cache, a budgeted bake order and coarser stand-ins.

`createPlaneScheme(tilePx)` names plane tiles `z/x/y`; a `TilePyramid` over a scheme runs a frame with `run(view, now, bake, budget)`, baking floor tiles, then missing ones on screen, then stale ones, then the level above and a ring past the screen, and answers what to draw, a coarser tile's matching part standing in for one not yet baked. The payload is the caller's, so the same pyramid holds GPU textures, bitmaps or terrain.

<!-- entry: rank=5 new api -->
