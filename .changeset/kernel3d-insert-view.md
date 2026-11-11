---
"@weasel-js/kernel3d": patch
---

An insert drag in a second 3D view lays its footprint where that view's camera ray meets the ground.

`createInsert` takes a `viewId`, as the other dep factories do, and casts the drag through that view's camera.

<!-- entry: fix api -->
