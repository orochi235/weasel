---
'@weasel-js/core': patch
---

An `ops.setSelection` built with a stale `from` is still recorded in history when it replaces a different selection; the adapter's `getSelection` decides whether it changed anything.

<!-- entry: fix -->
