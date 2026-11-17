---
'@weasel-js/core': patch
---

`scene.history.goto` throws on a depth outside the history and while a journal is open, as `History.goto` does.

<!-- entry: fix behavior -->
