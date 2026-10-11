---
'@weasel-js/storage': patch
'@weasel-js/prefs': patch
---

`RecordCache.whenRead()` and `PrefsStore.whenRead()` resolve once storage has been read: at once for one that opened with its records, and when a later read lands for one whose first read failed. Work an opener does once at open can rerun there.

Prefs use it to record `$version` when a late first read finds nothing stored; before, values set while storage was away were persisted with no version, and the next open migrated them from 0. A `$version` another writer deletes, as clearing the store does, is written back for the same reason.
