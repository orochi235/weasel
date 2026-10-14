---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/svg': patch
'@weasel-js/stroke': patch
'@weasel-js/text': patch
'@weasel-js/parallax': patch
---

`@weasel-js/geom`'s six-number affine type is `Affine`, no longer `Mat3`. It sat one capital letter from `mat3`, the namespace over the nine-element column-major `GlMat3` a GL uniform takes, and the two are different matrices. `mat3.toAffine` and `mat3.fromAffine` already named the conversion this way.

Breaking: `import type { Mat3 } from '@weasel-js/geom'` becomes `import type { Affine }`. The values are unchanged, and so are the free functions beside the type (`identity`, `multiply`, `invert`, and the rest).
