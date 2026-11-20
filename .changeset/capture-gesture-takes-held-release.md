---
'@weasel-js/routing': patch
---

`captureGesture` keeps a press still held when it settles from the page until the pointer comes up. That covers its moves, its release, and the click after it, whether Escape, an abort, a key, or a right press's menu settled it.

<!-- entry: fix -->
