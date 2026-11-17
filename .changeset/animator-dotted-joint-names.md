---
'@weasel-js/animator': minor
---

A joint named with a dot, as Blender's `spine.001` is, no longer comes along with `axes: ['spine']`: a name reaches its own joint's axes only.

`TargetAxes` takes an optional `paths`, each axis's name as its path's steps, which `skeletonAxes` and plain objects' axes now give. A name that is both one axis's and the start of another's path throws.

<!-- entry: fix api -->
