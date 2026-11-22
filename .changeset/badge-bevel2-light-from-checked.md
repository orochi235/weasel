---
'@weasel-js/ui': patch
---

A `bevel2` badge effect throws a `RangeError` for a `lightFrom` that is not a finite number of degrees, where it had drawn its bevel solid black.

<!-- entry: fix behavior -->
