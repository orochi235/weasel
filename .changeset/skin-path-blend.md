---
'@weasel-js/animator': patch
'@weasel-js/core': patch
---

Adds API, in `@weasel-js/animator`: the first piece of skinning, where one path bends with a skeleton. `skinPath(path, skin, motions)` moves each point of a path to where its joints' motions since the bind pose would carry it, averaged by weight, and answers a new path. A `Skin` is one weight array per joint name, indexed by point: every coordinate pair of a polygon path's `coords`, curve handles included, or a rect's four corners. `motionsFromRest(skeleton, world)` turns the joint world transforms `resolveSkeleton` or `Rig.world()` answers into those motions. `autoSkin(path, skeleton, { power, max })` makes a skin from each point's distance to the bones at the bind pose; a joint with no child gets no weight, so a limb needs an end joint.

Nothing draws a skinned path yet: these are the pure functions the rig will call.
