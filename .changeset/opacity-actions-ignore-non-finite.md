---
'@weasel-js/editing': patch
---

`setFillOpacity` and `setStrokeOpacity` ignore an `alpha01` that is not a finite number, rather than writing a `NaN` opacity.

<!-- entry: fix -->
