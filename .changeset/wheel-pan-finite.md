---
'@weasel-js/core': patch
---

`wheelPan` (and so `computeWheelAction`) leaves an axis where it was when its delta is not finite or would carry
the view past the double range. It wrote `NaN` or `Infinity` into the view.
