---
'@weasel-js/paint': patch
---

`strokeHasInk` is false, and `strokeKey` is `'none'`, for a stroke whose `dash` holds a NaN or infinite entry, which draws nothing.

<!-- entry: fix -->
