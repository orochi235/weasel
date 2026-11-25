---
'@weasel-js/routing': patch
---

Adjusting a kept drag does nothing once its action is unregistered, muted, or refused. A custom `LastOperationHost` answers this through its new `admits(id, params)`.

<!-- entry: fix -->
