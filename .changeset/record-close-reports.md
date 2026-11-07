---
'@weasel-js/storage': patch
'@weasel-js/prefs': patch
'@weasel-js/labkit': patch
---

`RecordCache.close()` resolves whether every queued write landed, as `flush()` does, since a write still queued once it closes is never sent. `PrefsStore.close()` and the lab store's `close()` pass that answer on. All three used to resolve `void`, so a failed final write went unreported. This breaks code that implements one of these interfaces with a `close` resolving `void`: it now has to resolve a boolean.
