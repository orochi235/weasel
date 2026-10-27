---
'@weasel-js/renderer': patch
---

An `{ kind: 'image' }` paint with no `width`/`height` tiles an SVG at the picture's natural size, so an image node with the same `src` re-rasterizing it larger no longer makes the tile jump. `TextureEntry` gains an optional `size`, the extent a texture stands for when its pixels are a resampling, which a texture paint with no extent tiles at.
