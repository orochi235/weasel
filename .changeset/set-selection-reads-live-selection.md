---
'@weasel-js/core': patch
---

An `ops.setSelection` with a stale `from` that replaces a different selection is recorded in history.

The adapter's `getSelection` decides whether it changed anything.

<!-- entry: fix -->
