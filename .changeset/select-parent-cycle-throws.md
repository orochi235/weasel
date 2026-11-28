---
'@weasel-js/select': patch
---

`holderOf` and `outermost` throw a `RangeError` when `parentOf` has a cycle, where they used to hang the page.

<!-- entry: fix -->
