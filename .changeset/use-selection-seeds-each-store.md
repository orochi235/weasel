---
'@weasel-js/editing': patch
---

`useSelection` seeds `initial` into a new `scene` store it is handed when that store has no selection yet, not only into the first.

<!-- entry: fix -->
