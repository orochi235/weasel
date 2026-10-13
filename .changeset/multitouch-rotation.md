---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

Additive: `InvocationCtx.multiTouch.rotation` is real. It was always 0; it is now the degrees the two primary fingers have turned since the gesture began, clockwise positive, and it keeps counting past a half turn. `MultiTouchEvent` carries the `angle` it is computed from, and `multiTouchGeometry` returns it beside the centroid and spread. An action that read `rotation` and relied on the 0 now sees the turn.
