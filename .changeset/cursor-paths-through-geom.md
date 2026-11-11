---
"@weasel-js/cursor": patch
---

cursor now depends on `@weasel-js/geom`. `placeCursorPath`, `haloFitsInBox`, and `rotationFitsInBox` read path data with geom's `tokenizePathData`, and `placeCursorPath` writes numbers through geom's `trimNumber`. An arc whose flags are written without a separator (`A 5 5 0 015 5`) now reads as SVG reads it, where `placeCursorPath` refused it.
