---
'@weasel-js/geom': patch
---

Path booleans read a large nonzero path whose rings cross by its winding, so where an opposed ring overlaps another, the overlap stays empty.

<!-- entry: fix -->
