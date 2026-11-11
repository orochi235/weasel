---
"@weasel-js/kernel3d": patch
---

`POSE3_COMPOSITION.decompose` reads a frame axis scaled too small to divide by, a subnormal scale say, as collapsed, as it already read a scale of 0. A world pose rebased into such a frame used to come back with an infinite position or scale, which composed back to `NaN`.
