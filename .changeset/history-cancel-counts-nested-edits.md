---
'@weasel-js/history': patch
---

Canceling a journal undoes its own edits and a nested journal's in the order they were made, counting an edit made two or more journals deep as the latest edit of the journal it sits in.

<!-- entry: fix -->
