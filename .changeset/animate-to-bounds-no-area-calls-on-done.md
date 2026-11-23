---
'@weasel-js/core': patch
---

`animateToBounds` into a viewport with no area, such as a canvas not yet measured, calls its `onDone` at once, since nothing moves.

<!-- entry: fix -->
