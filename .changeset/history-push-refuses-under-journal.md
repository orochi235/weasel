---
'@weasel-js/history': patch
---

`History.apply()`, `applyOps()`, `recordEntry()` and `restore()` throw while a journal is active, as `undo()` does, so an edit can no longer land beneath the journal's later commit.

<!-- entry: fix -->
