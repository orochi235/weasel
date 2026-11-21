---
'@weasel-js/ui': patch
---

A `Select` throws a `RangeError` when two `options` have values that read the same as text, such as `1` and `'1'`.

<!-- entry: behavior -->
