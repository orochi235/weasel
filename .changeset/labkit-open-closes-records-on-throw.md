---
'@weasel-js/labkit': patch
---

`openLabStore` closes its records when building the store throws. A lab that fails to open, and every retry of it, stops listening to storage.

<!-- entry: fix -->
