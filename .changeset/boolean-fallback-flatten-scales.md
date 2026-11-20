---
'@weasel-js/geom': patch
---

A boolean that falls back to flattening its curves keeps a small circle round. It now flattens to within a ten-thousandth of the inputs' size, at most half a unit.

<!-- entry: fix -->
