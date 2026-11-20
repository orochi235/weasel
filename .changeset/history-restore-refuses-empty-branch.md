---
'@weasel-js/history': patch
---

`History.restore()` refuses a snapshot holding a branch with no entries. `branches()` and `switchBranch()` had thrown a `TypeError` on one later.

<!-- entry: fix -->
