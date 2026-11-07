---
'@weasel-js/renderer': patch
---

The canvas draws an inner- or outer-aligned stroke on outline-tier text on its own side of each glyph's edge, as `writePdf` already did. It used to draw the stroke centered on the edge whatever its `align`.
