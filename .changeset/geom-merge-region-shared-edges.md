---
"@weasel-js/geom": patch
"@weasel-js/text": patch
---

`mergeRegion` keeps an edge two contours share once instead of twice, merges a contour drawn twice into one, welds corners that lie within its snap of each other, and drops the zero-width spike two nearly tangent curves left behind. Overlapping rectangles that share a side used to come back with the shared stretch, or the whole inner rectangle, still drawn inside the fill, so a stroke traced it. Synthetic-bold outlines from `textToPath` and `textClusters` merge their glyphs' overlapping contours this way, and now stroke only along the glyph's edge.
