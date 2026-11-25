---
'@weasel-js/history': patch
---

The docs for `Op.coalesceKey` say keyed ops must write absolute values. A coalesced entry keeps only its first batch to undo and its latest to redo; a relative edit uses `recordEntry`'s `coalesceKey`.

<!-- entry: fix -->
