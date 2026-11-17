---
'@weasel-js/animator': patch
---

A nested timeline whose `duration` is below 0 samples its tracks and books its events as one of 0, as it already fired them.

<!-- entry: fix -->
