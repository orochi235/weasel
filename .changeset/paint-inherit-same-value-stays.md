---
'@weasel-js/editing': patch
---

A paint action that would give an `'inherit'` fill or stroke the paint it already inherits leaves the node inheriting. It records no undo entry.

<!-- entry: fix -->
