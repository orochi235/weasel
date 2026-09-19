---
'@weasel-js/core': patch
---

Bind a rig to scene nodes. `useRig({ scene, skeleton, bindings })` (or
`bindRig` outside React) maps joint names to the node or nodes that ride them;
`rig.pose(pose, root?)` resolves the skeleton and moves every bound node
through the scene's pose overrides, so a per-frame write records no history and
bumps no version. Each node keeps the offset from its joint that it has at the
bind pose, so nodes are authored in place over the rest skeleton. `apply` is
the one part that knows the pose shape: the default, `rigidRigApply(descriptor)`,
carries a node's center and rotation with its joint through any pose
descriptor, mirrored roots included; supply your own to size nodes from joint
scale or to treat some nodes differently. `rig.bake()` writes the current frame
into the document as one undo entry, `rig.release()` drops the overrides, and
`rig.world()` returns the last resolved joint transforms.

This adds API and changes nothing existing.
