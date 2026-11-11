---
'@weasel-js/core': patch
---

`unionBounds` and `unionAABB` skip a box with a corner that is not finite, and a union of only such boxes is `null`.

<!-- entry: rank=-5 fix -->
