---
'@weasel-js/editing': patch
---

`setFill` or `setStroke` set to None on a node with no fill or stroke leaves it as it is, and records no undo entry.

<!-- entry: fix -->
