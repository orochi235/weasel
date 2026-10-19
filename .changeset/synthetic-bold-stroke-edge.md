---
"@weasel-js/geom": patch
"@weasel-js/text": patch
---

A stroke on synthetic-bold text traces only the glyph's edge. The grown outline overlapped itself where grown parts met and looped at some inside corners, which a fill hides and a stroke drew as stray lines inside the glyph. New in geom: `mergeRegion`, which redraws a nonzero region as its outline alone, cutting contours where they cross and keeping only the pieces with fill on one side, curves kept as curves.
