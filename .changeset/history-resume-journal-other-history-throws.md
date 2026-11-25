---
'@weasel-js/history': patch
---

`resumeJournal` throws for a journal another history opened, leaving it suspended. That history's own undo and edits stay guarded while the journal is open.

<!-- entry: fix -->
