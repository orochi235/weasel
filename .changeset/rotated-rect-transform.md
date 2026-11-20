---
'@weasel-js/core': patch
---

`rotatedRectCorners` and `rotatedRectContainsPoint` follow a pose's `transform`, and `rotatedRectContainsPoint` hits inside a box with a negative width or height.

<!-- entry: fix -->
