---
'@weasel-js/theme': patch
---

`parseBoxShadow` throws on a `calc()` length rather than reading it as part of the color.

It also reads `px` and `inset` in any case.

<!-- entry: fix -->
