---
'@weasel-js/renderer': patch
---

On WebGL, `writeBuffer` with a `length` of 0 writes nothing, as it does on WebGPU.

<!-- entry: fix -->
