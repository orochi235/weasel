---
'@weasel-js/icons-plugin': patch
---

A dev server passes over an `icons.table.json` change whose directory is removed before it is read, rather than throwing.

<!-- entry: fix -->
