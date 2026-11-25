---
'@weasel-js/editing': patch
---

Make Boolean Group is disabled as locked while a node it would rewrite is locked, as Group is, and `makeBooleanGroup` returns `null` there.

<!-- entry: fix -->
