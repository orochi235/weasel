---
'@weasel-js/core': patch
---

An `ops.setPath` with a stale `from` that overwrites a different path is recorded in history.

The node, read through the adapter's `getNode`, decides whether it changed anything.

<!-- entry: fix -->
