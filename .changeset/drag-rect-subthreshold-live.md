---
'@weasel-js/core': patch
---

`useDragRect`'s `onEnd` reads `isSubThreshold` for the box it currently has, after any `setStart` or `setCurrent` it made.

<!-- entry: fix -->
