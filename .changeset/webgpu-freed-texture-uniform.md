---
'@weasel-js/renderer': patch
---

On WebGPU, a custom shader holding a freed texture samples it as unset, as WebGL does, instead of failing the frame's drawing.

<!-- entry: fix visual -->
