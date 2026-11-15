---
'@weasel-js/editor': patch
---

A document `readStored` could not read is no longer saved over or removed until its copy under `<key>:unreadable` has landed.

Until then `writeSession` and `useAutosave` try the copy again on each save and answer false, so `onSaved` reports the failure; once it lands, saves go through as usual.

<!-- entry: fix -->
