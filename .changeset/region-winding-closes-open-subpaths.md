---
'@weasel-js/geom': patch
---

`mergeRegion` and `growRegion` read a path's winding with every subpath closed, as they draw it, so an open path under `openFill: 'none'` merges unchanged and grows outward rather than inward.

<!-- entry: fix -->
