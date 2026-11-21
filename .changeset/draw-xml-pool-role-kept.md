---
'@weasel-js/diagram-formats': patch
---

A pool or a container written to draw-style XML reads back as what it was, an empty pool and a container of one tall container included.

The writer marks each swimlane with a `weaselRole` style key, which a draw app ignores; a file without one is still read by how its swimlanes stack.

<!-- entry: fix data -->
