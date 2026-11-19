---
'@weasel-js/core': patch
---

A rig with a bound or skinned node deleted since binding bakes the rest of its nodes, and stops showing an override for the deleted one

`Rig.bake` and each pose skip a node the scene no longer holds; one an undo brings back is shown again on the next pose.

<!-- entry: fix -->
