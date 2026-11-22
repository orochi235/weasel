---
'@weasel-js/renderer': patch
---

`readIds` on a WebGL target made without ids answers zeros, no id, as WebGPU does, rather than its colors read as ids.

<!-- entry: fix -->
