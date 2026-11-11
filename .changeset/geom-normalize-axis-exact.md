---
"@weasel-js/geom": patch
"@weasel-js/kernel3d": patch
---

The 3D `normalize` maps a vector along an axis to exactly that axis. So kernel3d's `planeBasis`, and the ground grid built on it, line up exactly with the world axes for an `up` that is not unit length, and grid snaps land on their grid values.

<!-- entry: fix -->
