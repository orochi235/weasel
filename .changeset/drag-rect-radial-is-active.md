---
'@weasel-js/core': patch
---

`useDragRect` and `useDragRadial` report `isActive` the moment `start`, `end`, or `cancel` runs, not after the next render.

<!-- entry: fix -->
