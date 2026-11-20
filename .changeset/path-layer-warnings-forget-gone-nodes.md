---
'@weasel-js/core': patch
---

`createPathLayer` stops remembering a mismatched vertex array's warning once the node is gone, so its memory stays bounded.

<!-- entry: fix -->
