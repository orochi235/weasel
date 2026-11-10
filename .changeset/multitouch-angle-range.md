---
"@weasel-js/gestures": patch
---

`multiTouchGeometry` reports a level pair of fingers whose second is left of the first at an angle of 180, as its range `(-180, 180]` says, instead of -180 when float noise or a `-0` put the second a hair above. The same hand no longer reads as 180 on one move and -180 on the next.
