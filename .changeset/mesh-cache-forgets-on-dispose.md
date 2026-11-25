---
'@weasel-js/renderer': patch
---

A renderer drawn after `dispose` uploads its meshes again instead of binding deleted buffers, and a second `dispose` frees what that drawing uploaded.

<!-- entry: fix -->
