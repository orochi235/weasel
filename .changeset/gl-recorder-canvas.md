---
'@weasel-js/renderer': patch
---

A `createGLRecorder` context has a `canvas`, so a renderer over it watches for context loss and a test can dispatch `webglcontextlost` there.

`drawingBufferColorSpace`, `unpackColorSpace` and `drawingBufferFormat` read as values rather than recording functions.

<!-- entry: fix -->
