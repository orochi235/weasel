---
'@weasel-js/history': patch
---

`History.undo()`, `redo()` and `goto()` throw while a journal is active even when there is nothing to step, as they do when there is.

<!-- entry: fix -->
