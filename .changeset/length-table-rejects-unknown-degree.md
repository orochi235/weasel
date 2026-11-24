---
'@weasel-js/geom': patch
---

`lengthTable` throws a `RangeError` for a curved segment whose controls are not one or two whole points, rather than measuring it as some other curve.

<!-- entry: fix behavior -->
