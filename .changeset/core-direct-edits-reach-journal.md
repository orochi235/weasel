---
"@weasel-js/core": patch
---

Every scene edit made while a journal is open records into that journal, not only `applyBatch`.

A direct call such as `setPose`, a `scene.batch`, and `scene.history`'s `apply`, `applyOps` and `recordEntry` now land there, so undo inside the journal takes them back and its commit lands them as one entry.

<!-- entry: rank=10 fix behavior -->
