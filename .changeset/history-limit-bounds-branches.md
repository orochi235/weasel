---
'@weasel-js/history': patch
---

A branching history's `historyLimit` also bounds the entries its kept branches hold. Past it, the oldest branch is evicted through `onEvict`.

<!-- entry: fix behavior -->
