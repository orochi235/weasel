---
'@weasel-js/renderer': patch
---

On WebGL, a draw sampling the target it draws into reads that texture as unset, as on WebGPU, instead of being dropped.

<!-- entry: fix visual -->
