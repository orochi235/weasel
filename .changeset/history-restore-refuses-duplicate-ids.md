---
'@weasel-js/history': patch
---

`History.restore` refuses a snapshot that names one entry id twice. Its undo stack, redo stack, and branches are checked together.

<!-- entry: fix -->
