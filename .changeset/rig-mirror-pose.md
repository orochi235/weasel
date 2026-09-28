---
'@weasel-js/core': patch
---

New `mirrorPose(skeleton, pose)` reflects a rig pose across the rig's y axis and returns it as ordinary deltas against the same skeleton, so a character can face the other way without a negative scale — which a scene pose such as `RectPose` cannot hold. Every joint resolves to exactly the reflection of the original, including joints the pose leaves at their bind, and mirroring twice returns the original pose.
