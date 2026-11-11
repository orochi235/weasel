---
'@weasel-js/core': patch
---

`zoomAt` keeps each axis's direction and a finite view for any factor or anchor.

A negative or `NaN` factor zooms nothing, a factor of 0 keeps a flipped axis flipped, and an anchor that is not finite, or whose world point overflows, zooms about the canvas corner.

<!-- entry: rank=-5 fix -->
