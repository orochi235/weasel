---
'@weasel-js/core': patch
---

Outline Stroke and a Boolean operation that counts strokes outline each stroke in the frame the canvas draws it in. A `{ px }` width is measured on screen, so under a view that scales its axes apart a line across the page and a line down it get different world widths, where both took the mean scale. A world width is skewed and stretched with its node when the adapter says how the node is drawn.

New API: `getStrokeFrame(id)` on `BooleansAdapter` and `CreateOutlinesAdapter`, optional, answering the node's `poseFrameOf` to world. `BooleanOpOptions.scale` and `applyOutlineStroke`'s `scale` take the view's per-axis scale as well as a number (`StrokeRegionOptions`). The built-in Pathfinder and Outline Stroke actions pass the view's scale per axis.

`applyOutlineStroke` no longer takes `StrokeToPathOptions`: a `frame` passed there is ignored, and `getStrokeFrame` is how a node's frame is given.
