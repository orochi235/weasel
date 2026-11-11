---
"@weasel-js/geom": patch
"@weasel-js/kernel3d": patch
---

The 3D `normalize` divides each component by the length rather than scaling by its reciprocal, so a vector along an axis normalizes to exactly that axis. `(28.96…, 0, 0)` normalized to `(0.9999999999999999, 0, 0)`, so kernel3d's `planeBasis`, and the ground grid built on it, ran an ulp off the world axes for an `up` that is not unit length, and grid snaps landed beside their grid values.
