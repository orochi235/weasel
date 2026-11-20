---
'@weasel-js/quantity': patch
---

A `fraction()` or `ratio()` field reads a typed division by zero, such as `1/0` or `-1:0`, as NaN rather than an infinity.

<!-- entry: fix -->
