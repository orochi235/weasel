---
'@weasel-js/core': patch
---

`rotatedRectCorners` and `rotatedRectContainsPoint` follow a pose's `transform`.

`rotatedRectContainsPoint` also hits inside a box with a negative width or height.

<!-- entry: fix -->
