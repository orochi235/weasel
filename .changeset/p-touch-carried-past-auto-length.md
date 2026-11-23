---
'@weasel-js/p-touch': patch
---

`writeLbx` skips, with a reason, an `lbxObjectsCommand` reaching past either end of an auto-length label, rather than write an object P-touch would grow the label for.

<!-- entry: fix -->
