---
'@weasel-js/text-dom': patch
---

`commitEdit()` called while the edit's `container` is `null` writes what was typed, instead of dropping it.

<!-- entry: fix -->
