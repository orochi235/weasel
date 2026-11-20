---
'@weasel-js/core': patch
---

`writtenBy` rebuilds each op through the scene's own `opRegistry`, so it reads a host-registered op as the scene commits it.

<!-- entry: fix -->
