---
'@weasel-js/core': patch
---

A box resized past its opposite edge can be clicked and marqueed again. A resize keeps the flip of a bare box pose as a negative width or height, and the click pick, the marquee and lasso, and `axisAlignedBounds` and `unionAABB` read such a box as covering nothing, so the node could no longer be selected on the canvas. `positiveBox` is the box with its extents made positive.
