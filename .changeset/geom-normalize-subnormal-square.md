---
"@weasel-js/geom": patch
---

The 3D `normalize` gives a unit vector for one whose squared length is subnormal, such as `(0, 0, 2.4e-155)`. Its square kept too few bits to divide by, so that vector normalized to a length of 1 + 1.7e-15 rather than to its axis.
