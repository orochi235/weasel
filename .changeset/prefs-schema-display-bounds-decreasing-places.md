---
'@weasel-js/prefs-schema': patch
---

`prefDisplayBounds` swaps the ends of a decreasing unit whose `places` round one stored unit to zero, so its min stays below its max.

<!-- entry: fix -->
