---
'@weasel-js/core': patch
---

Setting the output grid no longer throws over a locked node off the new grid.

Locked nodes keep their stored pose and data, and every other node snaps.

<!-- entry: fix behavior -->
