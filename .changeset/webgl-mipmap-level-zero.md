---
'@weasel-js/renderer': patch
---

On WebGL, a `mipmap: true` texture with no mipmaps yet, or resized since they were made, draws its image as on WebGPU, not black.

<!-- entry: fix visual -->
