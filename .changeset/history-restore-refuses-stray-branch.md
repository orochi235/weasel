---
'@weasel-js/history': patch
---

`History.restore` refuses a snapshot with a branch forking from an entry it does not hold. Such a branch could never be reached or evicted.

<!-- entry: fix -->
