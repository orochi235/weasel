---
'@weasel-js/cursor': patch
---

`haloFitsInBox` and `rotationFitsInBox` measure an arc whose radius is too short for its endpoints at the radius SVG draws it with, half the distance between them.

<!-- entry: fix -->
