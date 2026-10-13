---
'@weasel-js/prefs': patch
---

Fixes: two mounted `usePrefsStore` callers naming one `storage` and `prefix` with different schemas took the prefix from each other on every render, and one was left holding a closed store that dropped its writes. Each schema now gets a store of its own over one shared set of records, so both stay open, a write through one is read by the other at once, and the records close when the last store over them does.

Changes behavior: a `schema` change on a mounted `usePrefsStore` no longer reads storage again; the new store opens over the records already held. Callers sharing a prefix must pass the same `migrations`, which run once when the first opens.
