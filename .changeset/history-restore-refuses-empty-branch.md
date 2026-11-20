---
'@weasel-js/history': patch
---

`History.restore()` refuses a snapshot holding a branch with no entries, as a snapshot of the wrong shape, where `branches()` and `switchBranch()` had thrown a `TypeError` on it later.

<!-- entry: fix -->
