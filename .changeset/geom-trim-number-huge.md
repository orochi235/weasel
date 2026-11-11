---
"@weasel-js/geom": patch
---

`pathToD` and `serializeSvg` write coordinates past about 1e302 as numbers, not `Infinity`. `trimNumber` writes such a number as the number it is.

<!-- entry: rank=-5 fix -->
