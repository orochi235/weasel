---
'@weasel-js/renderer': patch
---

On WebGL, a draw or stencil clear inside a pass lands in that pass's target after a read-back or a new target made mid-pass, as on WebGPU.

<!-- entry: fix visual -->
