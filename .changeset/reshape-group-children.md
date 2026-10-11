---
'@weasel-js/core': patch
---

Resizing, rotating, flipping, aligning, or distributing a selected group now acts on its children on a scene with absolute poses. A group there derives its pose from its children, so the pose these actions wrote to the group changed nothing on screen. Resize scales each child inside the group's box, rotate orbits each child about the group's center, flip mirrors the children about the group's box, and align and distribute carry the children by the group's shift. A group selected beside other nodes is resized with them the same way, and a `resizePolicy.expandIds` result is now honored for a multi-selection as well as a single one.
