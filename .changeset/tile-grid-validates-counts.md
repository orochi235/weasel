---
'@weasel-js/guides': patch
---

`tileGrid` rounds `cols` and `rows` down, and one under 1 or not finite gives a grid with no cells, which refuses every child, instead of writing `NaN` poses.

<!-- entry: fix -->
