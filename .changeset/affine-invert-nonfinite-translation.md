---
"@weasel-js/geom": patch
---

`invert` returns null for an affine whose translation is `NaN` or infinite, as its doc says and as the 3D `invert` already did, instead of an inverse with a `NaN` translation.
