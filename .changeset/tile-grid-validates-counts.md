---
'@weasel-js/guides': patch
---

`tileGrid` rounds `cols` and `rows` down, and one under 1 or not finite gives a grid with no cells instead of `NaN` poses.

<!-- entry: fix -->
