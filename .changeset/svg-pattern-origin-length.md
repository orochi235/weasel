---
'@weasel-js/svg': patch
---

A `<pattern>`'s `x` and `y` are read as SVG lengths, so a unit or percentage resolves. An empty or unreadable one reads as 0 instead of a `NaN` origin.

<!-- entry: fix -->
