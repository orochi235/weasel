---
'@weasel-js/history': patch
---

`History.undo`, `redo` and `goto` throw while a journal is active, as `beginJournal` does, rather than stepping the stack under the journal's edits.

<!-- entry: fix -->
