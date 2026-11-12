---
"@weasel-js/core": patch
---

A `createTransformOp` whose `from` equals its `to` still records an undo step when the node it moves was somewhere else.

<!-- entry: fix -->
