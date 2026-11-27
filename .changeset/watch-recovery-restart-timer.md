---
'@weasel-js/forge': patch
---

`watchRecovery` stops checking files when a dev server that has restarted closes, and starts each restarted server with no files from the last one.

<!-- entry: fix -->
