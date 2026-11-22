---
'@weasel-js/tiles': patch
---

A `TileStream` whose `load` throws instead of returning a rejected promise reports the error to `onError` and goes on loading other tiles.

<!-- entry: fix -->
