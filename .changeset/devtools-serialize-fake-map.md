---
'@weasel-js/devtools': patch
---

A devtools value that only claims to be a `Map` or `Set` through `Symbol.toStringTag` is shown, not refused.

<!-- entry: fix -->
