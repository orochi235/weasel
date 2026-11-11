---
'@weasel-js/ui': patch
---

`createRecentColorsStore` reads a NaN `limit` as the default 12 and a fractional one as its whole part.

<!-- entry: rank=-5 fix -->
