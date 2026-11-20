---
'@weasel-js/editor': patch
---

`useAutosave` and `useSessionPersistence` pass the error to `onSaved(false, error)` when the save itself throws.

With no `onSaved`, the error is logged with `console.error`, as for a throwing `write`.

<!-- entry: fix -->
