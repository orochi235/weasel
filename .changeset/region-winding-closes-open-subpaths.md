---
'@weasel-js/geom': patch
---

`mergeRegion` and `growRegion` read an open path's winding as they draw it, closed, whatever its `openFill`.

An open path under `openFill: 'none'` merges unchanged and grows outward.

<!-- entry: fix -->
