---
'@weasel-js/geom': patch
---

`splitPathBySegment` and `splitPathByPolyline` cut a shape whose longest side is a cubic with a cusp at its middle, rather than returning `null`.

<!-- entry: fix -->
