---
"@weasel-js/geom": patch
---

`portControls` and `portCurvePoints` stay finite between ends whose distance, or its square, passes the double range. They answered `Infinity` or `NaN` control points and samples there.
