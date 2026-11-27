---
'@weasel-js/core': patch
---

A view animation on a controlled `<SceneCanvas>` stops when the consumer writes `view` themselves, even after they dropped a frame the animation handed them.

<!-- entry: fix -->
