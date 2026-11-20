---
'@weasel-js/renderer': patch
---

An SVG image with a huge declared size loads within the GPU's texture limits. Its first raster keeps the texture side and 4096 × 4096-pixel ceiling later rasters already keep.

<!-- entry: fix -->
