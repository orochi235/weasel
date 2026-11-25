---
'@weasel-js/history': patch
---

`recordEntry` records an op that names what it `caused` as those ops, as `applyOps` does. Undo and redo return to what it wrote rather than deciding again.

<!-- entry: fix -->
