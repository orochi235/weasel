---
'@weasel-js/renderer': patch
---

A built-in pattern tile unregistered with `unregisterTexture` has its bitmap closed when the tile is rebuilt or evicted, rather than left for garbage collection.

<!-- entry: fix -->
