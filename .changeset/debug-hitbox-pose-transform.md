---
'@weasel-js/core': patch
---

Fixes: the debug overlay drew the hitbox of a rect or ring affordance region as a turned rect on a target whose bounds carry a `transform`. Such a region is recorded as the quad it lands on; a target that is only turned still records the unturned box and its rotation.
