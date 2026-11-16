---
'@weasel-js/registry': minor
---

A `createReflectable` store reads one key's whole stack of registrants with `stack(key)`.

`stack(key)` returns the key's registrants live last, the order `entries()` reports as `shadowed` then `live`, without building the store's entries. The array is frozen and stays the same object until that key changes; a key holding none gives an empty array.

<!-- entry: api -->
