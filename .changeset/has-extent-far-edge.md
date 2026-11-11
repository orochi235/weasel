---
'@weasel-js/core': patch
---

`hasExtent` reads bounds whose far edge (`x + width` or `y + height`) overflows the double range as nothing to fit,
so `fitViewToBounds` answers `null` for them rather than a view at `NaN`.
