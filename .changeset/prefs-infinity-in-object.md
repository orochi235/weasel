---
'@weasel-js/prefs': patch
---

An endless number inside an `object` or `union` leaf keeps its infinity on JSON storage. `store.set` wrote the infinity as a string only for a bare number, a list, or a map, so `{ cap: Infinity }` reached localStorage as `{"cap":null}` and read back as the field's default after a reload. A list or map of objects had the same hole.
