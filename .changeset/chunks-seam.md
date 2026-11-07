---
'@weasel-js/renderer': patch
---

A `chunks` tile draws a chunk crossing its edge again past the opposite edge, in the raster tile and in the shapes `tileGeometry` gives an SVG export. Such a chunk was cut off where the tile ended and nothing continued it in the next, so a chunks fill showed flat-sided chunks along a grid at the tile size.
