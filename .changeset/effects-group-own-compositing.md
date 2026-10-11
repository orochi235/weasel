---
'@weasel-js/core': patch
---

A group draw command with `effects` ignored its own `alpha`, `colorMatrix`, and `clip`: a `LayerGroup` that set `effects` and `alpha` together drew its blur at full opacity. The group's result is now composited at its alpha, through its color matrix, and cut to its clip.
