---
'@weasel-js/animator': patch
---

`decay` throws a `RangeError` for a friction out of range, as `tween` and the clock do for their bad numbers.

<!-- entry: fix -->
