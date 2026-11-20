---
'@weasel-js/headless': patch
---

The raster host goes on rendering after its page's WebGL2 context is lost: the next render opens a new session.

<!-- entry: fix -->
