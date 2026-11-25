---
'@weasel-js/history': patch
---

Restoring into a history without `branching` no longer rebuilds the branches it drops. An op only a dropped branch holds no longer fails a strict restore or appears in `unresolved`.

<!-- entry: fix -->
