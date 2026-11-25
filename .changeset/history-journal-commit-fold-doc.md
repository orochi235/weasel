---
'@weasel-js/history': patch
---

`Journal.commit`'s documentation says that a session recorded under one `coalesceKey` folds into the parent's top entry under that key, keeping its label.

<!-- entry: fix -->
