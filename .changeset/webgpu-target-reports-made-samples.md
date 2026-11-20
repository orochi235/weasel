---
'@weasel-js/renderer': patch
---

A WebGPU render target reports the sample count it was made with, 4 or 0, and counts its `bytes` from that rather than from the count asked for.

<!-- entry: fix -->
