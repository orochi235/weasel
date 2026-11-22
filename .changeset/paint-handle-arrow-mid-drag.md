---
'@weasel-js/ui': patch
---

`GradientHandles` and `MeshHandles` ignore an arrow key while a handle is dragged.

Canceling the drag then still puts the value back where the drag began.

<!-- entry: fix -->
