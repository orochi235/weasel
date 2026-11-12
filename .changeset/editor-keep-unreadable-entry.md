---
'@weasel-js/editor': patch
---

`readStored` keeps an entry it cannot parse under `<key>:unreadable`, with a `console.error`, so the next autosave no longer erases the only copy.

<!-- entry: fix data -->
