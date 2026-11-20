---
'@weasel-js/history': patch
---

The inverse of a `createSwapOp` op carries the op's `name` and its `args` with `before` and `after` swapped, so an `observe` listener can read what an undo of a swap applied.

<!-- entry: fix -->
