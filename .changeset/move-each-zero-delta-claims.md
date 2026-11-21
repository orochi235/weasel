---
'@weasel-js/core': patch
---

`moveEachOps` leaves a node where a zero-delta entry reaches it, even when a later entry reaches it too.

<!-- entry: fix -->
