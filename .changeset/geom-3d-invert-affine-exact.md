---
"@weasel-js/geom": patch
---

The 3D `invert` gives an affine matrix an inverse whose bottom row is exactly `0, 0, 0, 1`, so the inverse stays affine and inverts back.

<!-- entry: rank=-5 fix -->
