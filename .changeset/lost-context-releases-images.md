---
'@weasel-js/renderer': patch
---

A renderer whose WebGL context is lost stops keeping the images it last drew from the image cache's budget, and stops capping other renderers' image texture size, even if the context never comes back.

<!-- entry: fix -->
