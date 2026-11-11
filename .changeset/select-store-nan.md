---
"@weasel-js/select": patch
---

`createSelectionStore` no longer notifies when written the same ids again, even when one of them is `NaN`.

<!-- entry: rank=-5 fix -->
