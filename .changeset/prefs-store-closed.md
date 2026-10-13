---
'@weasel-js/prefs': patch
---

Adds API: `PrefsStore.closed`, true once `close` was called. A closed store reports `writable: false`, and its first `set` or `reset` warns that the write will not persist; before, the write changed the store's memory and was dropped in silence.
