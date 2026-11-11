---
"@weasel-js/storage": patch
---

Deleting a record a second time, while the first delete is still waiting to be written, does nothing. It reported another local change and queued the delete again.
