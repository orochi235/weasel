---
'@weasel-js/core': patch
---

`scene.reorder` called without an index moves the node to the end of its siblings, as `scene.move` does, instead of to the start.

<!-- entry: fix -->
