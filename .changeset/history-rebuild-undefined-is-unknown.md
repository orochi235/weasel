---
'@weasel-js/history': patch
---

A history's own `rebuildOp` answering `undefined` reports the op as unknown during `restore`. It no longer throws a `TypeError`.

<!-- entry: fix -->
