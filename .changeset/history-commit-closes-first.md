---
'@weasel-js/history': patch
---

A journal is closed by the time its commit notifies the parent history's listeners, so a listener can read `activeJournal()` as null and edit the parent.

<!-- entry: fix -->
