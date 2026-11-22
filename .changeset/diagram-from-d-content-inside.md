---
'@weasel-js/diagram': patch
---

`outlineFromD` throws a `RangeError` on a `content` box that is not inside the unit square, or whose position is not finite.

<!-- entry: fix behavior -->
