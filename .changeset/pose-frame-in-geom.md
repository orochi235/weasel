---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

geom: the box-pose frame math lives here now: `poseFrameOf`, `poseFrameInverseOf`, `poseLinearOf`, `pathThroughPoseFrame`, `poseRotationOf`, and `rotatePathAround`, with the `PoseLinear` and `PoseRotation` types. They read a pose as plain numbers and need no scene. `@weasel-js/core` still exports every one of them.
