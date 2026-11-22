---
'@weasel-js/renderer': patch
---

`createTarget` throws for a multisampled target with `ids`, which neither backend could draw into.

<!-- entry: fix behavior -->
