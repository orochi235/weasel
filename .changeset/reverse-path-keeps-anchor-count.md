---
'@weasel-js/geom': patch
---

`reversePath` keeps a closed contour's anchor count when its closing edge is implicit, so reversing twice gives the original path back.

<!-- entry: fix -->
