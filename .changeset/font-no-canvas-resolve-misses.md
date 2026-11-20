---
'@weasel-js/font': patch
---

Resolving a canvas-served font where there is no canvas, as under SSR or in a worker without `OffscreenCanvas`, misses instead of throwing.

<!-- entry: fix -->
