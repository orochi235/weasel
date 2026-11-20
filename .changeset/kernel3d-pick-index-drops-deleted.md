---
'@weasel-js/kernel3d': patch
---

kernel3d's pick index lets go of a deleted node's box, so a long session of inserts and deletes no longer grows it.

<!-- entry: fix perf -->
