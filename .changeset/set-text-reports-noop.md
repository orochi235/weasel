---
'@weasel-js/core': patch
---

An `ops.setText` that writes the text a node already holds no longer adds an undo step that changes nothing.

<!-- entry: fix -->
