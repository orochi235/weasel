---
'@weasel-js/core': patch
---

`createCanvasReader` answers null on a canvas with no renderer yet, rather than opening a WebGL 2 context there.

That context would have kept a WebGPU renderer from painting on the canvas.

<!-- entry: fix -->
