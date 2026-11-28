---
'@weasel-js/core': patch
---

`DrawCanvas` and `SceneViewCanvas` hold their first paint while off screen, as they do every later one, and retry it on the next frame if it throws.

<!-- entry: fix -->
