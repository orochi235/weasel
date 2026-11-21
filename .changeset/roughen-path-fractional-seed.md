---
'@weasel-js/geom': patch
---

`roughenPath` roughens differently for seeds that differ only in their fraction or past 32 bits.

Whole-number seeds roughen as before.

<!-- entry: fix -->
