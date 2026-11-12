---
"@weasel-js/core": patch
---

A canvas surface painting with WebGPU lets go of its renderer when it unmounts, rather than leaving it held by the page's GPU device.

<!-- entry: fix perf -->
