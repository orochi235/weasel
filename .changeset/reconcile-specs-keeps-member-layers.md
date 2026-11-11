---
"@weasel-js/core": patch
---

`reconcileSpecs` no longer moves a group's members to its new layer when only the group's own layer changed. `setLayer` carries a node's subtree, so a member above its group came down with it; the render worker's copy of a scene then drew that member on the wrong layer after an undo that put the group back under it. A member is now put back on its own layer wherever its group's layer still allows.
