---
'@weasel-js/core': patch
---

`selectAll` no longer selects nodes on a hidden layer, so Cmd+A then Delete
cannot take content the user cannot see.

It walked `renderOrder()`, which is every node in the scene regardless of what
its layer's `visible` flag says. It now walks `renderOrderNodes()` when any
layer is hidden — the same sequence, carrying the layer each node sits on — and
keeps the cheaper id walk when every layer is visible.

A `scene` dep that answers neither `layers` nor `renderOrderNodes` behaves
exactly as before.
