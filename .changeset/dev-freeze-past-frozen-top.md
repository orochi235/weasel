---
'@weasel-js/core': patch
---

In development, a write into a node's pose or `data` throws even when the value you stored was already frozen at its top level with `Object.freeze`.

<!-- entry: fix -->
