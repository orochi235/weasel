---
'@weasel-js/history': patch
---

A journal's commit recorded its entry with separate forward and base op lists even when nothing inside the journal coalesced, so the parent treated it as a coalesced entry. When undoing or redoing that entry threw partway, the unwind replayed the entry's other half on top of undoing what had run, and an op that is not idempotent landed twice. The commit now records one list for both halves when every entry inside the journal holds one.
