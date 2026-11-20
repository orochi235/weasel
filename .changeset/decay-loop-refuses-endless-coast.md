---
'@weasel-js/core': patch
---

`useDecayLoop` and pan `inertia` throw a `RangeError` on a `friction` outside (0, 1) or a non-positive `minSpeed`, which coasted forever.

The pan checks when the drag is pressed.

<!-- entry: fix -->
