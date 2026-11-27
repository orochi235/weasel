---
'@weasel-js/registry': patch
---

`deepEqual` compares an array with no prototype only to itself, never to an object keyed by its indices.

<!-- entry: fix -->
