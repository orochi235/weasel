---
'@weasel-js/renderer': patch
'@weasel-js/paint-kinds': patch
---

Paint kind loaders stack like the kinds: disposing a newer loader for an id uncovers the older one again.

Disposing a loader that was overridden removes only that one.

<!-- entry: fix behavior -->
