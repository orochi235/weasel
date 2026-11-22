---
'@weasel-js/svg': patch
---

A `<pattern>`'s `x` and `y` are read as lengths, so a unit or percentage resolves as other SVG lengths do, and an empty or unreadable one reads as 0 instead of a `NaN` origin.

<!-- entry: fix -->
