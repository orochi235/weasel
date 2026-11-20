---
'@weasel-js/renderer': patch
---

`writeBuffer` on a WebGPU device throws on a write it cannot make exactly, one starting off a multiple of 4 bytes or ending off one short of the buffer's end, rather than zeroing the bytes after it or dropping it.

<!-- entry: fix behavior -->
