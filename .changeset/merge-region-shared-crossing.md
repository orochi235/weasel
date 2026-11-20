---
'@weasel-js/geom': patch
---

`mergeRegion` cuts every edge crossing at one point at the same point, so shapes overlapping about a shared center merge without a stray sliver of fill.

<!-- entry: fix visual -->
