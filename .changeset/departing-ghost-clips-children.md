---
'@weasel-js/core': patch
---

A removed container that clips its children (`clip: 'outline'` or `clipFromPose`) keeps clipping them while `poseTransition` exit fades it out.

<!-- entry: fix -->
