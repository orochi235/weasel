---
'@weasel-js/labkit': patch
---

`.auto()` with no resolver drops one an earlier `.auto(fn)` set, so the leaf reads `undefined` while auto.

<!-- entry: fix -->
