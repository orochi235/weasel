---
'@weasel-js/core': patch
---

`useDecayLoop`'s `start` throws a `TypeError` when given `viewBounds` and a `boundary` without a `position` or an `initialPosition` to check them from.

<!-- entry: fix -->
