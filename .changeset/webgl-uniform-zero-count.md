---
'@weasel-js/renderer': patch
---

A WebGL program's ranged uniform write of no numbers writes nothing, as on WebGPU, rather than the rest of the array.

<!-- entry: fix -->
