---
'@weasel-js/tiles': patch
---

A tile whose `bake` answered null still counts in `TilePyramid.run`'s `pending`, so a caller asks for the frame that finishes it.

<!-- entry: fix -->
