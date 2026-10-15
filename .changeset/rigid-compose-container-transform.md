---
'@weasel-js/core': patch
---

`composeRigidPose` composes a container's `transform` into its children, and `decomposeRigidPose` takes it back out. A child under a skewed or unevenly scaled container now answers a world pose whose box center, rotation, and `transform` draw it where the container's frame puts it; what the child's box and rotation cannot hold of the result is written to the child's own `transform`. Breaking for a scene that set a `transform` on a container under `RIGID_POSE_COMPOSITION` and relied on its children ignoring it. `composeRectPose` is unchanged: under it a container's pose only offsets its children, so neither its rotation nor its `transform` reaches them.
