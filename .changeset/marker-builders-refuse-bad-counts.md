---
'@weasel-js/geom': patch
---

`circlePath` throws a `RangeError` for fewer than 3 segments, and `roundRectPath` for fewer than 1 corner sample, where they built empty or NaN geometry.

<!-- entry: fix behavior -->
