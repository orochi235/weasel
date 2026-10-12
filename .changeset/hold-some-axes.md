---
'@weasel-js/core': patch
---

A hold can cover some of a target's axes. `animator.hold({ target, value, weight, axes })` holds only the axes it names; the rest are left to the target's other holds and its committed value, and releasing it commits only those. `SampledTrack.axes` does the same for a timeline track, and `jointAxes(skeleton, names)` answers the axes of a rig's joints, so an arm solved by IK can be held at full strength beside clips holding the body.

Each axis is shared among the holds that cover it: weights are summed and capped per axis, where they were summed across the whole value.
