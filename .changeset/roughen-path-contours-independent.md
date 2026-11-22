---
'@weasel-js/geom': patch
---

`roughenPath` roughens every contour independently, where a contour past 65,536 points repeated the next contour's offsets. A path of more than one contour roughens differently for the same seed.

<!-- entry: fix visual -->
