---
'@weasel-js/paint': patch
---

`lerpPaint`, `lerpFill` and `lerpStroke` keep the color of a fully transparent solid, and of the clear end of a fade, rather than answering black.

<!-- entry: fix -->
