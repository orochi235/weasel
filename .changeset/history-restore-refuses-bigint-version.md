---
'@weasel-js/history': patch
---

`History.restore` refuses a snapshot whose `version` is a BigInt or holds a cycle, rather than throwing a `TypeError`.

<!-- entry: fix -->
