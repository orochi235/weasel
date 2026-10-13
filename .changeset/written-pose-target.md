---
'@weasel-js/core': patch
---

`createWrittenPoseTarget({ read, write, descriptor?, onRest? })` makes a pose target over a store that holds one pose per node and has no overrides table, such as a hand-written adapter's. It keeps the committed pose while the node moves and writes the store the pose on screen each frame. Hand it back from the adapter's `poseTarget(id)` and moves on one node add: a second `tweenPose` no longer cancels the first, and `springPose` starts at their combined velocity. Canceling a move leaves the store at the pose on screen. A write to a moving node's pose from somewhere else is overwritten at the next frame.
