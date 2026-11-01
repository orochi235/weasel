---
"@weasel-js/core": patch
---

A marquee or lasso now selects at the depth a click does. A hit inside a group that isn't entered selects the outermost such group, not the marks inside it. `AreaSelectDep` and `LassoSelectDep` take an optional `targetOf(id)` for this, and `<SceneCanvas>` wires it from the entered group.

A clone's selection outline now lands on its ghost under a parent away from the origin. A previewed pose is read in the frame the node is stored in, as the ghost and the published overrides read it. The scene adapter gains `worldOfStored(id, stored)` to carry it to world, and `getEffectivePose` now answers world during a preview as well as after it.
