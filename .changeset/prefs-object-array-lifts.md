---
'@weasel-js/prefs-schema': patch
---

Setting one field of an `object` leaf holding an array lifts the array through `fromScalar` rather than spreading it.

A class instance is read the same way: only a plain object is the leaf's object form, as when its value is read.

<!-- entry: fix -->
