---
'@weasel-js/renderer': patch
---

A WebGL renderer made from a `canvas` reads the canvas back as its last frame left it, even after the browser has shown it.

<!-- entry: fix -->
