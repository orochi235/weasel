---
'@weasel-js/core': patch
---

`animateToBounds` into a viewport with no area stops the camera move already in flight before it calls `onDone`, so the view `onDone` reads is where the camera stays.

<!-- entry: fix -->
