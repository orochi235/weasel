---
'@weasel-js/renderer': patch
---

On WebGL, a shader still holding a deleted texture reads transparent black, as on WebGPU. It used to read whatever texture last held its slot.

<!-- entry: fix visual -->
