---
'@weasel-js/core': patch
---

`withPath` and `reshapeOps` store a path in the frame a node's parent has now, after the parent moves, rather than in the frame it had when the same path was last stored.

<!-- entry: fix -->
