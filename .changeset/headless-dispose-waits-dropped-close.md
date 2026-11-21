---
'@weasel-js/headless': patch
---

A raster host's `dispose()` resolves only once every browser it launched is closed, including one it dropped after its page crashed or closed.

<!-- entry: fix -->
