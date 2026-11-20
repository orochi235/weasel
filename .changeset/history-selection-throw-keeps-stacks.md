---
'@weasel-js/history': patch
---

An undo or redo whose `HistorySelection.set` throws still moves its entry and notifies subscribers. The next undo no longer inverts the same entry twice.

<!-- entry: fix -->
