---
'@weasel-js/theme': patch
---

`blendTheme`, and `applyTheme` with `weights`, give a finite value for extreme lengths and shares instead of `Infinity` or `NaN`. An infinite share takes its whole axis, as a split pref's infinite weight does.

<!-- entry: rank=-5 fix -->
