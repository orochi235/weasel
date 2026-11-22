---
'@weasel-js/geom': patch
---

`boundsOfCoords` and `aabbOfPoints` answer null when every value on an axis is NaN, rather than a box from Infinity to -Infinity.

<!-- entry: fix -->
