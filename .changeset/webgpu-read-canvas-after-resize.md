---
'@weasel-js/renderer': patch
---

`readPixels` on a WebGPU canvas resized since its last frame reads that frame's own rows, with zeros where the rect lies past it.

<!-- entry: fix -->
