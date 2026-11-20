---
'@weasel-js/renderer': patch
---

`writeBuffer` on a WebGPU device throws on a write it cannot make exactly, rather than zeroing the bytes after it or dropping it.

That is a write starting off a multiple of 4 bytes, or ending off one short of the buffer's end.

<!-- entry: fix behavior -->
