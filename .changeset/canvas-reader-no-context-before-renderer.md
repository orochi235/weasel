---
'@weasel-js/core': patch
---

`createCanvasReader` answers null on a canvas that has no renderer yet, instead of opening a WebGL 2 context that would keep a WebGPU renderer from painting there.

<!-- entry: fix -->
