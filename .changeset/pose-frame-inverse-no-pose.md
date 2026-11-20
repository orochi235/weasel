---
'@weasel-js/geom': patch
---

`poseFrameInverseOf` and `pathThroughPoseFrame` accept a `null` or `undefined` pose. They answer `null` and the path as it is, as `poseFrameOf` does, rather than throwing.

<!-- entry: fix -->
