---
"@weasel-js/editor": patch
---

`useSessionPersistence` now drops a saved undo stack when the scene beside it is missing, unparseable, or not a saved scene, rather than replaying it against whatever the app started with instead.
