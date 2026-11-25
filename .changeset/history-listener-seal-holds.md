---
'@weasel-js/history': patch
---

A `subscribe` or `observe` listener that calls `seal()`, `undo()` or `redo()` on hearing a push or a coalesce now ends the coalescing run, so the next keyed edit starts a fresh entry.

<!-- entry: fix -->
