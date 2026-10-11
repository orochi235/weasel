---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

geom: `mat3`, the `GlMat3` type, and `viewToMat3` live here now, moved from core's renderer. `@weasel-js/core/renderer` still exports all three. `mat3` works on the nine-element column-major matrix a GL uniform takes; geom's `Mat3` type and its free functions (`identity`, `multiply`, `invert`) remain the six-number affine.
