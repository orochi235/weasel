---
'@weasel-js/core': patch
---

`hasExtent` reads bounds whose far edge overflows the double range as nothing to fit, so `fitViewToBounds` answers `null` for them.

<!-- entry: rank=-5 fix -->
