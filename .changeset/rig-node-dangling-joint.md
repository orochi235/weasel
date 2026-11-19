---
'@weasel-js/core': patch
---

`useRigNode` warns about, and leaves out, a node naming a joint its skeleton no longer has, instead of throwing during render

A node bound to a renamed or removed joint is not bound, and a skin weighing one bends by its other joints. `rigFromNode` leaves them out the same way.

<!-- entry: fix -->
