---
'@weasel-js/renderer': patch
---

A tile pattern that could not rasterize is drawn once an `OffscreenCanvas` becomes available, and tiles that fail no longer push working ones out of the pattern cache.

<!-- entry: fix -->
