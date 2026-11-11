---
'@weasel-js/core': patch
---

`wheelPan` and `computeWheelAction` leave an axis where it was when its delta is not finite or would carry the view past the double range.

<!-- entry: rank=-5 fix -->
