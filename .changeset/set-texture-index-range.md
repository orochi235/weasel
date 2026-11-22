---
'@weasel-js/renderer': patch
---

`setTexture` throws a `RangeError` for an index outside the sampler it names, on both backends. On WebGL it used to replace another sampler's texture.

<!-- entry: fix behavior -->
