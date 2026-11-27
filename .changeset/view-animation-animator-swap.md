---
'@weasel-js/core': patch
---

A camera runner handed a new animator mid-move can still stop the move it started. `isAnimating`, `stop`, and the next `animate` reach the old animator's move.

<!-- entry: fix -->
