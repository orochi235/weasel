---
'@weasel-js/geom': patch
---

`poseFrameInverseOf` answers `null`, and `pathThroughPoseFrame` the path as it is, for a `null` or `undefined` pose, as `poseFrameOf` does, rather than throwing a `TypeError`.

<!-- entry: fix -->
