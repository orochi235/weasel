---
'@weasel-js/geom': patch
---

`pathFaceArrangement` throws a `RangeError` for a `flattenTolerance` that is not a positive number. That includes zero, negatives, NaN and Infinity.

<!-- entry: fix behavior -->
