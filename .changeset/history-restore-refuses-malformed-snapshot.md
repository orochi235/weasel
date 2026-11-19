---
'@weasel-js/history': patch
---

`History.restore` refuses a snapshot of the wrong shape, such as one storage corrupted, with `HistoryRestoreError` and leaves the history as it was.

A best-effort restore warns and reports `restored: false` instead.

<!-- entry: fix data -->
