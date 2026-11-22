---
'@weasel-js/core': patch
---

A wheel over a node painted on top of a scroll container goes to that node's own scroll containers, or pans the view, instead of scrolling the container beneath.

`scrollableAt` takes an optional fourth argument, the id of the node topmost at the point, to answer the same way.

<!-- entry: fix api -->
