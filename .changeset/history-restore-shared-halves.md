---
'@weasel-js/history': patch
---

A history restored from `serialize()` treated every entry as coalesced, since its forward and base ops came back as two separate lists. When an undo or redo of such an entry threw partway, the unwind then replayed the entry's other half on top of undoing what had run, so an op that is not idempotent (an insert, an increment) landed twice. `restore` now shares one list between the halves when they serialize the same, as the live entry did.
