---
'@weasel-js/core': patch
---

Setting the output grid no longer throws when a locked node sits off the new grid; locked nodes keep their stored pose and data, and every other node snaps.

<!-- entry: fix behavior -->
