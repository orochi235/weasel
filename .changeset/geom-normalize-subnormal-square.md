---
"@weasel-js/geom": patch
---

The 3D `normalize` gives a unit vector for one whose squared length is subnormal, such as `(0, 0, 2.4e-155)`.

<!-- entry: rank=-5 fix -->
