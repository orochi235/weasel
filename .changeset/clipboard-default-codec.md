---
'@weasel-js/core': patch
---

The kit's clipboard writes and reads its payload through the snapshot codec by default, so a copy between two canvases keeps a path's typed arrays and non-finite numbers.

<!-- entry: fix -->
