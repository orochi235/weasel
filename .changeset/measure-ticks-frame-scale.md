---
'@weasel-js/core': patch
---

A measurement node's end ticks keep their screen size in a frame painted at another density than the window's, as `renderSceneToPixels` does.

<!-- entry: fix visual -->
