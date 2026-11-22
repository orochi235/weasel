---
'@weasel-js/kernel3d': minor
---

`withAabb(pose, box, local?)` is a pose moved and scaled so its world box is `box`, the inverse of `aabbOfPose`.

It keeps the pose's rotation, and is exact for an unrotated pose; a box that only moves keeps the scale exactly.

<!-- entry: api -->
