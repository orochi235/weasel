---
'@weasel-js/tiles': patch
---

A `TileStream` whose `release` or `onError` throws still frees that load's slot, so later loads keep starting.

<!-- entry: fix -->
