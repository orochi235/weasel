---
'@weasel-js/history': patch
---

An undo or redo whose `HistorySelection.set` throws still moves its entry and notifies subscribers, so the next undo does not invert the same entry twice.

<!-- entry: fix -->
