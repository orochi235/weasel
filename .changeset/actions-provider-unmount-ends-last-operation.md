---
'@weasel-js/routing': patch
---

Unmounting an `<ActionsProvider>` ends the last operation run under it, which stops watching a history that outlives the provider.

<!-- entry: fix -->
