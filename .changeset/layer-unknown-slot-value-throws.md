---
'@weasel-js/core': patch
---

A value in `layers` under a key that is no slot, and that is not a `{ layer }` entry, `null` or `undefined`, throws instead of being dropped.

A misspelled slot such as `selectionOverly: { handles: { size: 12 } }` used to configure nothing without a word; it now throws naming the key.

<!-- entry: fix behavior -->
