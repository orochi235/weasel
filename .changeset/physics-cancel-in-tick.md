---
'@weasel-js/core': patch
---

A `spring`, `decay`, or `physics` animation canceled from its own `onTick` on the frame it came to rest still called `onDone`. It now never completes once canceled, as a `tween` already did.
