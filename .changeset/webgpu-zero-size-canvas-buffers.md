---
'@weasel-js/renderer': patch
---

A WebGPU canvas with zero width or height keeps one set of buffers instead of making new ones for every pass.

<!-- entry: fix perf -->
