---
'@weasel-js/renderer': patch
---

A multi-call tile bake that fails as it starts frees the buffer it drew in, rather than holding it until the renderer is disposed.

<!-- entry: fix -->
