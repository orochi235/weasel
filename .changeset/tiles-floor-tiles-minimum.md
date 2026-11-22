---
'@weasel-js/tiles': patch
'@weasel-js/core': patch
---

`planeFloor`, and a tiled layer's `floorTiles`, throw a `RangeError` for fewer than 2 tiles a side, which no level could keep to.

<!-- entry: fix behavior -->
