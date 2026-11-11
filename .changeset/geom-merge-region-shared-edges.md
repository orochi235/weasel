---
"@weasel-js/geom": patch
"@weasel-js/text": patch
---

`mergeRegion` keeps an edge two contours share once, so a stroke no longer traces lines inside a merged fill. It also merges a contour drawn twice into one, welds corners within its snap of each other, and drops the zero-width spike two nearly tangent curves leave. Synthetic-bold outlines from `textToPath` and `textClusters` merge their glyphs this way, so they stroke only along the glyph's edge.

<!-- entry: fix visual -->
