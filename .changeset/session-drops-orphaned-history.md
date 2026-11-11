---
"@weasel-js/editor": patch
---

`useSessionPersistence` drops a saved undo stack when the scene saved beside it is missing or unreadable, rather than replaying it.

<!-- entry: fix -->
