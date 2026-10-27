---
'@weasel-js/geom': patch
---

`tessellate` measures a rect reaching past `ORIGIN_THRESHOLD` (2^14) from an origin, as it already did for a polygon that carries one, so a rect drawn far from 0 keeps the fractions of its corners. The mesh's `origin` says where; a rect near 0 has none, as before.
