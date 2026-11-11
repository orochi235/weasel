---
'@weasel-js/core': patch
---

`scene.add`, `scene.move`, and `scene.reorder` record the index a node lands at, so a history read back from JSON places it alike.

The index is held to the ends of its siblings: an add or move at `Infinity` records the last index.

<!-- entry: fix data -->
