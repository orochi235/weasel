---
"@weasel-js/core": patch
---

A built-in polygon's `sides` and a star's `points` are rounded and held to 3–32, as the shape generator holds them.

A fractional, zero, huge or infinite count no longer draws a lopsided outline or an empty path, or stalls the frame.

<!-- entry: fix visual -->
