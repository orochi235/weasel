---
'@weasel-js/core': patch
---

`useRigNode` keeps a rig moving when its skeleton's joints are added, removed, or reordered. The rig still gets a new `target`, but that target takes over the placement and the committed pose of every joint the skeleton still names, where it used to start at the bind pose, and an animation that was running goes on running on the target it was started on and shows through the new one. A joint that was renamed is a different joint, and stops moving.
