---
'@weasel-js/core': patch
---

`fitViewToBounds` returns the current view for a viewport whose width or height is `NaN` or infinite, rather than a `NaN` view.

<!-- entry: fix -->
