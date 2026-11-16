---
'@weasel-js/editor': patch
---

`useAutosave` and `useSessionPersistence` pass the error to `onSaved(false, error)` when the save's `write` throws.

With no `onSaved`, the error is logged with `console.error`.

<!-- entry: fix -->
