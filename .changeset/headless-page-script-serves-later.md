---
'@weasel-js/headless': patch
---

A raster host's page script may call `serveHeadlessPage` after its fonts load, up to 30 seconds after it runs, rather than only at once.

<!-- entry: fix -->
