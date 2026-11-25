---
'@weasel-js/history': patch
---

`recordEntry` keeps its own copy of the ops it is handed, as `applyOps` does. A caller can reuse or clear the array afterward.

<!-- entry: fix -->
