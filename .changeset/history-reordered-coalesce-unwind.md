---
'@weasel-js/history': patch
---

An undo or redo that throws partway leaves the state where it was, for an entry coalesced from batches that listed their ops in different orders.

<!-- entry: fix -->
