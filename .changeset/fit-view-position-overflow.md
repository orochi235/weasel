---
'@weasel-js/core': patch
---

`fitViewToBounds` returns the current view when the fitted position would fall past the double range, rather than an infinite camera position.

<!-- entry: fix -->
