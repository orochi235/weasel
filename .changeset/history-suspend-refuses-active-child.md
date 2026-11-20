---
'@weasel-js/history': patch
---

`Journal.suspend()` throws while a journal opened inside it is still active, so a history never has an open journal it does not count.

<!-- entry: fix -->
