---
'@weasel-js/geom': patch
---

`stepLine` throws a `RangeError` for a step that is zero or not finite. A step of that kind has no multiples to hold a direction to.

<!-- entry: fix behavior -->
