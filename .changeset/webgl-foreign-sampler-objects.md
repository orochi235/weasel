---
'@weasel-js/renderer': patch
---

On a shared WebGL context, a sampler object other code leaves bound no longer overrides the renderer's texture filtering and wrapping.

<!-- entry: fix visual -->
