---
"@weasel-js/diagram": patch
---

`setDiagramFontSize` throws a `RangeError` on a size of 0 or less, `NaN`, or an infinite size, and leaves the shapes as they were.

<!-- entry: fix behavior -->
