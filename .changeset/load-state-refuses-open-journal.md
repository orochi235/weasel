---
'@weasel-js/core': patch
---

`scene.loadState` throws while a journal is open, so the journal can no longer replay the old document's edits onto the loaded one.

Commit or cancel an open journal, suspended ones included, before loading.

<!-- entry: fix behavior -->
