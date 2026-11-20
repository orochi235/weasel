---
'@weasel-js/geom': patch
---

`circlePath` throws a `RangeError` for fewer than 3 segments, and `roundRectPath` for no corner samples.

They built empty or NaN geometry.

<!-- entry: fix behavior -->
