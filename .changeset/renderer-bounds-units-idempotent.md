---
'@weasel-js/renderer': patch
---

`paintToBoundsUnits` returns a gradient or pattern already in `'bounds'` units unchanged, rather than dividing it by the box a second time.

<!-- entry: fix -->
