---
'@weasel-js/core': patch
---

A layer's `parallax` options are owned by the scene once handed to it, as poses are: in development, writing into them throws.

Hand `setLayerParallax` a new object for each change rather than mutating the one it was given.

<!-- entry: fix behavior -->
