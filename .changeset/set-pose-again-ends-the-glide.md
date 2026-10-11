---
'@weasel-js/core': patch
---

`animateOnSetPose`: writing a node's pose again while its glide was still running wrote the new pose through, and the running tween's next frame put the node back on its way to the first target. The second write now cancels the glide, and its pose stands.
