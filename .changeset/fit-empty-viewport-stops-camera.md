---
'@weasel-js/core': patch
---

`animateToBounds` into a viewport with no area stops the camera move in flight. The view `onDone` reads is where the camera stays.

<!-- entry: fix -->
