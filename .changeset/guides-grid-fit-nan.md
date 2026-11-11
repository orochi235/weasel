---
"@weasel-js/guides": patch
---

`gridFit` counts a point that is not finite as off the grid, and every point as off it under a `NaN` tolerance; both fit before.
