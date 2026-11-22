---
'@weasel-js/tiles': patch
---

`TileCache.put` with the payload a tile already holds, such as a texture redrawn in place, keeps it rather than releasing it.

<!-- entry: fix -->
