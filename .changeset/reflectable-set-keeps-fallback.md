---
'@weasel-js/registry': patch
---

`Reflectable.set` over an engine default keeps it one, so a same-rank `push` over it no longer warns of a clash.

<!-- entry: fix -->
