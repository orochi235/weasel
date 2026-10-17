---
'@weasel-js/geom': patch
---

`tessellate` covers a nonzero path once where its outlines nest without crossing. A ring inside another ring wound the same way was triangulated as a second shape, so the region they share was covered twice and a translucent fill drew darker there. An opposite-wound ring inside a hole, which nonzero fills, was left empty, and a counter listed before the outline around it was filled. Rings are now grouped by the winding inside each one, and a path that winds twice anywhere is rebuilt as the boundary of its fill before triangulating. Glyph outlines, whose counters wind opposite to the outline around them, triangulate as before and at the same cost.
