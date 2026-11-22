---
'@weasel-js/tiles': patch
---

A `TilePyramid` whose floor alone breaks `maxBytes` lowers its level only while that puts fewer tiles on screen, not to level -64.

<!-- entry: fix -->
