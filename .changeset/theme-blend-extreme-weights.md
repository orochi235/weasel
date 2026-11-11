---
'@weasel-js/theme': patch
---

`blendTheme` (and `applyTheme` with `weights`) blends lengths near the double range's end, and shares too large to add or too small to multiply, to a finite value between the ends instead of `Infinity` or `NaN`. An infinite share now takes its whole axis, as a split pref's infinite weight does.
