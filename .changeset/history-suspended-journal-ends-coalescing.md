---
'@weasel-js/history': patch
---

An edit made while a journal is suspended starts a new undo entry. It no longer merges into the entry from before the journal opened, so undoing it leaves the journal's edits in place.

<!-- entry: fix -->
