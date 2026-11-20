---
'@weasel-js/editor': patch
---

Saves queued behind one whose `onSaved` threw still run, in `useAutosave` and `useSessionPersistence`.

The throw is logged with `console.error`.

<!-- entry: fix -->
