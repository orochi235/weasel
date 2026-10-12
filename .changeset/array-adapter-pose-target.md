---
'@weasel-js/core': patch
---

Moves on one node now combine over an `arrayAdapter` too. It has a `poseTarget`, so `tweenPose`, `springPose`, `animateOnSetPose`, and `momentum` add over it as they do over a scene, where each used to cancel the move before it.

**This changes behavior over `arrayAdapter` and `useArrayAdapter`:**

- A second `tweenPose` on a node no longer cancels the first; both run under `pose:<id>` and add. `springPose` interrupts them and starts at their combined velocity.
- The array still holds the pose on screen while a node moves, and `getPose` answers it. Canceling a move leaves the array at that pose.
- A write to a moving node's pose from somewhere else is overwritten at the next frame, as it was.
- `momentum` coasts on the node's target: a decay per node, where it wrote every node from one.

New API:

- `createWrittenPoseTarget({ read, write, descriptor?, onRest? })` makes a pose target over a store that holds one pose per node and has no overrides table. It keeps the committed pose while the node moves and writes the store the pose on screen.
- `ArrayAdapterConfig.poseTargets` is the map an adapter keeps its targets in. Adapters built over the same items share one so a node keeps one target; `useArrayAdapter` does this itself.
