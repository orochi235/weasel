---
'@weasel-js/editor': patch
---

`editorMenuBar` keeps a menu keyed `__proto__` as its own entry, and builds one keyed `constructor` only from its own contribution.

<!-- entry: fix -->
