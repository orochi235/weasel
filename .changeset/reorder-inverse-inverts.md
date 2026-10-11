---
'@weasel-js/core': patch
---

Inverting the inverse of `createReorderOp` or `createMoveToIndexOp` returned an op that did nothing. It now returns the original reorder, so an undo step that fails partway and unwinds puts sibling order back.
