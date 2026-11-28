---
'@weasel-js/core': patch
---

`hasStroke` reports no stroke for an infinite width, which the renderer draws nothing for, so Outline Stroke no longer offers to outline it.

<!-- entry: fix -->
