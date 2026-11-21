---
'@weasel-js/labkit': patch
---

A chrome contribution reusing a built-in's id is told to suppress the built-in and give its own another id. A trial's `suppress` applies after the merge, so the same id still collides.

<!-- entry: fix -->
