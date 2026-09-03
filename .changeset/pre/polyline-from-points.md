---
'@weasel-js/core': patch
---

Add `polylineFromPoints` — the open counterpart to `polygonFromPoints`.

Same geometry, without the closing edge. A freehand stroke or a measurement
line wants this; a region wants the closed one. The pencil tool's drag preview
was building its ghost with `polygonFromPoints`, so the edge from the newest
sample back to the first swept across the drawing as the stroke grew and read
as a marquee.
