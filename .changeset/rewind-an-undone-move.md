---
'@weasel-js/core': patch
---

A pose move can rewind when it is undone. `tweenPose`, `springPose`, and `staggerSpringPose` take `rewind: true`: undone mid-flight, a tween travels back to where it began along the positions it passed, at the pace it passed them, and a spring springs back from where it is at the speed it has; redone on the way back, either turns forward again. `onDone` is called only when the move arrives at its destination. Without `rewind` a move undone mid-flight comes to rest on the undone pose at once, as before, and any write that is not the move's own undo or redo still wins at once either way. It needs an adapter with `poseTarget`, which every scene adapter has.

This adds API, and its shape was chosen on an agent's judgment: an option per move, off by default, and a rewind that turns on the frame after the undo.
