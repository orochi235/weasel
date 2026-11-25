---
'@weasel-js/editing': patch
---

Transform Again no longer repeats a rotation after a rotate whose behavior committed its own ops; the rotate clears what it would have repeated, as clone and resize do.

<!-- entry: fix -->
