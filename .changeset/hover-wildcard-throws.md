---
'@weasel-js/gestures': patch
---

`bindingSpec` and `routeToSpec` throw on `hover(*)`, which used to fire on moves only; bind `hover(move)` and `hover(leave)` separately.

<!-- entry: fix behavior -->
