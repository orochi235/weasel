---
'@weasel-js/core': patch
---

`reconcileSpecs` threw "it is locked" when the specs changed a node that stayed locked, a node inside a locked group, or added a node to a locked layer: it only unlocked a node whose own spec dropped `locked`. It now syncs with the lock guard lifted, as a replay does, and still leaves each node locked or unlocked as `next` says.
