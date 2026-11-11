---
"@weasel-js/routing": patch
---

`mergeMenuDefs` keeps every child of every merged menu, including one keyed `__proto__` or `~sep1`. The separator between two contributions takes the next free key.

<!-- entry: rank=-5 fix -->
