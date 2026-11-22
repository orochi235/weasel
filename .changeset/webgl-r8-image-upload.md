---
'@weasel-js/renderer': patch
---

An image uploaded into an `r8` texture on WebGL keeps its red channel, as on WebGPU, and later partial writes to the texture land.

<!-- entry: fix -->
