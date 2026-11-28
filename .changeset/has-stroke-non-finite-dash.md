---
'@weasel-js/core': patch
---

`hasStroke` reports no stroke for one whose dash is non-finite, which draws no line, so Outline Stroke is no longer offered for it.

<!-- entry: fix -->
