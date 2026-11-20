---
'@weasel-js/geom': patch
---

`stepLine` throws a `RangeError` for a step that is zero or not finite, where it answered a line of `NaN` direction that held a constrained drag at its press.

<!-- entry: fix behavior -->
