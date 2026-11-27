---
'@weasel-js/core': patch
---

A `<CanvasView>` whose `parent` chain loops back to itself paints nothing and picks nothing, instead of overflowing the stack.

<!-- entry: fix -->
