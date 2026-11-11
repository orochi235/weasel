---
"@weasel-js/prefs": patch
---

A store from `usePrefsStore` resolves `close()` with whether every queued write reached storage, as `flush()` does, rather than with `undefined`.

<!-- entry: fix -->
