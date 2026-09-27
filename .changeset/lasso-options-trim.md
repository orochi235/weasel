---
"@weasel-js/core": patch
---

`useLassoTool({ minVertexSpacing })` now spaces the lasso's vertices by the value given; it used to be accepted and ignored. `transient`, `label`, `onGestureStart`, `onGestureEnd` and `debug` are removed from `UseLassoToolOptions` and `UseLassoSelectOptions`: nothing read them, so passing one did nothing. This is a breaking change to those types for any caller that passed one.
