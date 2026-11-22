---
'@weasel-js/quantity': patch
'@weasel-js/ui': patch
---

`scaleBar` and `ScaleBar` throw a `RangeError` for an empty `lengths` instead of drawing a bar labeled NaN. Leave `lengths` out for the default lengths.

<!-- entry: fix -->
