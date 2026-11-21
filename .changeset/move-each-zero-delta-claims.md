---
'@weasel-js/core': patch
---

`moveEachOps` leaves a node where its first entry puts it even when that entry's delta is zero, so align and distribute no longer move an already-placed node through a later entry.

<!-- entry: fix -->
