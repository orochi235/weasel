---
'@weasel-js/renderer': patch
---

`GpuProgram.set` documents its `offset` and `count` as numbers of `data`, written from the uniform's start, which is how both backends read them.

<!-- entry: fix -->
