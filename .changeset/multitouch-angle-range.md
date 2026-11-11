---
"@weasel-js/gestures": patch
---

`multiTouchGeometry` reports a level pair of fingers whose second is left of the first at 180, never -180, as its range `(-180, 180]` says.

<!-- entry: rank=-5 fix -->
