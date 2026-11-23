---
'@weasel-js/icons-plugin': patch
---

A dev server passes over an `icons.table.json` change whose file or directory is removed before it is read, rather than throwing from its file watcher.

<!-- entry: fix -->
