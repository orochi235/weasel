---
'@weasel-js/core': patch
---

`viewZoom` and `meanScale` returned `NaN` for a view with one flipped axis, such as a y-up `{ x: 2, y: -2 }`, so every chrome rule with a zoom threshold read false and the select tool's stroke pick tolerance was `NaN`. A view flipped on both axes reported a negative zoom. Both now take the mean of the axes' magnitudes.
