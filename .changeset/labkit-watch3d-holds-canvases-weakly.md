---
'@weasel-js/labkit': patch
---

In development, a long-lived WebGPU device no longer keeps every canvas it configured, and the closed trials around them, in memory.

<!-- entry: fix -->
