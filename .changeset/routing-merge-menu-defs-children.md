---
"@weasel-js/routing": patch
---

`mergeMenuDefs` keeps every child of every merged menu. A child keyed `__proto__` was dropped, and the separator between two contributions overwrote a first contribution's child keyed `~sep1`; the separator now takes the next free key.
