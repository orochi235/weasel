---
'@weasel-js/renderer': patch
---

`renderer.programsReady()` and `warmPrograms()` finish when the WebGL context is lost or restored while shaders are still compiling.

<!-- entry: fix -->
