---
'@weasel-js/core': patch
---

`fitSize` and `fitZoom` throw a `RangeError` for a viewport with no area, instead of fitting into a 1-pixel box at the minimum zoom.

<!-- entry: fix -->
