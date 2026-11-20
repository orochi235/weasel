---
'@weasel-js/devtools': patch
---

A devtools hook connection stops listening to its transport when the panel says `bye`, not only when its close is called.

<!-- entry: fix -->
