---
'@weasel-js/core': patch
---

Adds API: pure edits to a `Skeleton`, each answering a new one. `moveJoint(skeleton, name, x, y)` rests a joint at a point, worked back through its parent's frame, and the joints under it move along. `addJoint(skeleton, parent, x, y, name?)` adds a joint at a point under a parent or as a root. `removeJoint(skeleton, name)` removes a joint and everything under it and says which names went, and `dropSkinJoints(skin, names)` takes those joints' weights out of a skin. `jointPositions(skeleton)` answers where each joint rests and `jointAt(skeleton, x, y, reach)` the joint nearest a point.
