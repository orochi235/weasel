---
'@weasel-js/theme': patch
---

`blendTheme` mixes a bare `0` with a length, such as `0` and `8px`, rather than snapping to one end.

`applyTheme` with `weights` blends the same way.

<!-- entry: fix visual -->
