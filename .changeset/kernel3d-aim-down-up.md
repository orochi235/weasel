---
'@weasel-js/kernel3d': patch
---

`aimSpace3d` and `aimOf3d` measure an aim point's height along `up` when `up` points down its axis, such as `{ x: 0, y: -1, z: 0 }`. They used to read it along the axis's positive direction, so a point above the ground projected below it.
