---
'@weasel-js/core': patch
---

An SVG image drawn at two very different sizes at once (a canvas and its minimap, or two nodes sharing one `src`) re-rasterized on every frame: each size replaced the other's raster. Once a shrunk raster has been asked to grow back, `getImageBitmap` no longer shrinks it below that size.
