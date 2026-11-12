---
'@weasel-js/core': patch
---

`useElementSize` and `useCanvasSize` measure an element that mounts late, and follow their ref to an element that replaces the first.

<!-- entry: fix -->
