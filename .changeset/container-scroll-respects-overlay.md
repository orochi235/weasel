---
'@weasel-js/core': minor
---

A wheel over a node painted on top of a scroll container no longer scrolls the container beneath it.

Only the scroll containers holding that node take the wheel, and with none it pans the view. `scrollableAt` takes an optional fourth argument, the id of the node topmost at the point, to answer the same way.

<!-- entry: fix api -->
