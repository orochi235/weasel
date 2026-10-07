---
'@weasel-js/core': patch
---

A `{ px }` stroke is now that many pixels wide in every direction under a non-uniform transform. It used to resolve through the mean of the two axis scales, so at a 4:1 view a 1px line painted 0.5px tall running across and 2px wide running down, and a rect outline, an ellipse or a diagonal came out uneven. The ribbon is built after the transform's stretch and mapped back to world, so it still batches and aligns like any other stroke. Marker heads on a `{ px }` stroke, and their outlines, are built the same way.

Dashes on a `{ px }` stroke are now screen pixels, as SVG's `non-scaling-stroke` (which a `{ px }` width serializes to) measures them; they used to be world units that grew and shrank with the zoom. A stroke with a world-unit width keeps world-unit dashes.

Picking and paint bounds follow. `NodeInk` gains `outsetPx` and `insetPx`, a reach measured on screen; the built-in painters report a `{ px }` stroke's reach there and leave `outset` and `inset` at 0 for it, so code that read a `{ px }` stroke's reach from `outset` must add `outsetPx`. `NodeInkCtx` gains `leastScale`, which `defaultPaintBounds` fills with the smaller axis scale so a node's paint box covers a `{ px }` stroke along the axis zoomed least, and culling measures the same way.
