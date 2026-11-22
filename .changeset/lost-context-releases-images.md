---
'@weasel-js/renderer': patch
---

A renderer whose WebGL context is lost releases the images it last drew. It also stops capping other renderers' image texture size, even if the context never comes back.

<!-- entry: fix -->
