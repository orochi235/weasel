---
'@weasel-js/core': patch
---

`fitSize` throws a `RangeError` for a `fill` outside (0, 1], instead of quietly returning the minimum zoom.

<!-- entry: fix -->
