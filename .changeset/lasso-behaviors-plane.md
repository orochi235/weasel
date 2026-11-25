---
'@weasel-js/editing': patch
---

Lasso Select's behaviors get the gesture's `plane` and the canvas's `kitSettings`, as rotate and clone behaviors do. The plane is read again on every move.

<!-- entry: fix -->
