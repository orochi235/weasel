---
'@weasel-js/geom': patch
---

Adds API: `TYPED_ARRAY_CONSTRUCTORS`, the constructor of each typed array `tagTypedArray` can write, under the tag it writes it by. `TypedArrayTag` is its keys and `NumberTypedArray` an instance of any of them, as before; the table they are read from is now exported with them.
