---
'@weasel-js/paint': patch
---

`paintWithAlpha` reads a `NaN` alpha as 0, so it never writes `opacity: NaN` into a paint.

<!-- entry: fix -->
