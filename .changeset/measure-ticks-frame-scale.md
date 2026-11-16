---
'@weasel-js/core': patch
---

A measurement node's end ticks keep their screen size in a frame painted at a density other than the window's, such as `renderSceneToPixels` or a render worker.

<!-- entry: fix visual -->
