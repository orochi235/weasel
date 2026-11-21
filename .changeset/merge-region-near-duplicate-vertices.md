---
'@weasel-js/geom': patch
---

`mergeRegion` keeps a contour whole where runs of near-duplicate vertices sit, with no straight edges drawn across the shape.

<!-- entry: fix visual -->
