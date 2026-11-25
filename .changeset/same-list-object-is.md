---
'@weasel-js/registry': patch
---

`sameList` compares elements with `Object.is` by default, as `createValueStore` does, so a repeated `NaN` is no change.

<!-- entry: fix behavior -->
