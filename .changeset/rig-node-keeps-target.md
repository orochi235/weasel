---
'@weasel-js/core': patch
---

`useRigNode` keeps its rig's `target` when it binds again. A change to the rig node or anything under it, a painted weight included, used to make a new rig with a new target, which dropped every animation running on the old one and left the nodes at rest. The rig returned is still a new object, but its `target`, its committed pose, and its placement carry over, and it shows the pose that was on screen as it binds. This is a behavior change: a rig posed with `rig.pose` used to go back to the bind pose when it bound again, and now stays posed. Adding, removing, renaming, or reordering a joint still makes a new target at the bind pose. `bindRig` and `useRig` are unchanged.
