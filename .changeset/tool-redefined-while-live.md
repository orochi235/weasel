---
'@weasel-js/routing': patch
---

A tool redefined under its id while it is live gets its old definition's `onDeactivate` and then its new one's `onActivate`, so each definition's setup is torn down by its own `onDeactivate`.

<!-- entry: fix -->
