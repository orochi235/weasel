---
"@weasel-js/storage": patch
---

A record cache rereads a record that another writer changed during the cache's own write, so cache and storage cannot disagree for good.

Such a change still reaches `onOverruled` when heard; a different value read back reaches listeners as a remote change.

<!-- entry: fix -->
