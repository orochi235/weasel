---
"@weasel-js/geom": patch
---

`invert` returns null for an affine whose translation is `NaN` or infinite, as the 3D `invert` already did.

<!-- entry: rank=-5 fix -->
