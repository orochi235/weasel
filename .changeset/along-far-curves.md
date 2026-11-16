---
'@weasel-js/geom': patch
---

`pathLengthTable` and `pointAtLength` keep a finite length and a tangent for curves past 1e154 or below 1e-154.

<!-- entry: fix -->
