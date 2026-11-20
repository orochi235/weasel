---
'@weasel-js/history': patch
---

`History.restore()` refuses a snapshot whose `version` is not 1, throwing `HistoryRestoreError` when strict and reporting `restored: false` when best-effort, as a scene snapshot in an unsupported version is refused.

<!-- entry: fix -->
