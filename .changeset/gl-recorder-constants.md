---
'@weasel-js/renderer': patch
---

A `createGLRecorder` context gives every WebGL constant the renderer uses its real value, rather than 0.

The constants added are `DRAW_FRAMEBUFFER`, `READ_FRAMEBUFFER`, `DYNAMIC_DRAW`, `R8`, `RED`, `UNSIGNED_SHORT`, `UNPACK_ALIGNMENT`, `SAMPLES`, and `RENDERER`.

<!-- entry: fix -->
