---
'@weasel-js/export': patch
---

`regionRenderArgs` hands a `background` function the document it draws, not the live scene with its in-flight edits.

<!-- entry: fix -->
