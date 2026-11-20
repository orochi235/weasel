---
'@weasel-js/core': patch
---

`scene.moveLayer` and `scene.addLayer` truncate a fractional index, so a layer moved to its own slot records no undo entry.

<!-- entry: fix -->
