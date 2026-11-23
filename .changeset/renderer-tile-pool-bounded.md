---
'@weasel-js/renderer': patch
---

Baked tiles keep at most 16 freed textures for reuse across every tile size together.

A tiled layer whose tile size changes with zoom no longer holds GPU memory for each size it has used.

<!-- entry: fix -->
