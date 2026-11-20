---
'@weasel-js/scale': patch
---

A scale asked for `NaN` or `Infinity` ticks gives its default ticks, rather than a tick per unit or per second that could run to millions.

<!-- entry: fix -->
