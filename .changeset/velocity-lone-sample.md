---
'@weasel-js/core': patch
---

A throw released while only one move falls in the last 100ms, or from a pointer reporting moves less often than that, now coasts at the speed of that move instead of stopping dead.

<!-- entry: fix -->
