---
'@weasel-js/renderer': patch
---

`writeBuffer` throws a `RangeError` for a write past the end of the buffer, on WebGL and WebGPU alike, rather than dropping it with a GPU error.

<!-- entry: fix behavior -->
