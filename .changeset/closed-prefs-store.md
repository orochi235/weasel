---
'@weasel-js/prefs': patch
---

Adds API: `PrefsStore.closed`, true once `close` has been called.

Behavior change: `set` and `reset` on a closed store are ignored, with a `console.warn` naming the path. Before, the write changed the values the store read back and never reached storage, with no warning. A closed store still reads.

`usePrefsStore` warns when a second mounted caller names a `storage` and `prefix` another holds with a different schema, which leaves one of the two holding a closed store. Its subscription now follows `schema` as well as `storage` and `prefix`.
