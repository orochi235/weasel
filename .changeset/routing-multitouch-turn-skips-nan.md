---
'@weasel-js/routing': patch
---

A multitouch gesture's `rotation` skips an angle that is not a finite number, rather than turning to `NaN` for the rest of the gesture.

<!-- entry: rank=-5 fix -->
