---
'@weasel-js/core': patch
---

`rig.pose()` commits through the rig's target, so a pose given while an animation from before a change of joints is still running shows as given rather than with that animation's travel so far added to it.
A `useRig` or `useRigNode` that unmounts while an animation on its target is still running no longer has that animation put its pose overrides back.
`animateLifecycle` over an adapter without pose targets removes a node at the pose it had before its exit animation, so undoing the removal brings it back where it was rather than at the exit pose.
A resize handle's cursor points along the axis the handle drags as it is drawn on screen: on the other diagonal for a mirrored target, and turned by a view that scales x and y differently.
