---
"@weasel-js/p-touch": patch
---

`writeLbx`, `lbxConfig`, and `sceneToLbx` refuse a label `length` that is not a positive finite number of points with a `RangeError`. A `NaN` or infinite length had been written as the paper's height and background width, and a zero or negative one as a label no printer feeds.
