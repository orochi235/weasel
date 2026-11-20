---
'@weasel-js/core': patch
---

An `ops.setPath` built with a stale `from` is still recorded in history when it overwrites a different path; the node, read through the adapter's `getNode`, decides whether it changed anything.

<!-- entry: fix -->
