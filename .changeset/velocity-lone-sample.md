---
'@weasel-js/core': patch
---

A throw with only one move in its last 100ms coasts instead of stopping dead. That covers a pointer reporting moves less often than every 100ms.

<!-- entry: fix -->
