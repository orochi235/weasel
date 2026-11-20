---
'@weasel-js/export': patch
---

`exportRegions` and `exportPages` reject when a registered format's `export` throws before returning its promise, instead of throwing.

<!-- entry: fix -->
