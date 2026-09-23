---
'@weasel-js/core': patch
---

The pen's curves now follow the handles you drag. Dragging while placing an anchor gives it an out-handle at the drag point and an in-handle mirrored through it, and each segment runs from its start anchor's out-handle to its end anchor's in-handle — as in Illustrator and Figma. Before, a segment's second control point was the mirror of the *previous* anchor's handle, which sat behind the start of the segment, and a dragged anchor never shaped the segment coming into it. The preview and the committed path both changed.

Alt held from the start of the drag leaves the anchor with no in-handle; Alt pressed part-way freezes the in-handle and moves only the out-handle. Dragging the endpoint of a path the pen picked up moves its out-handle only, leaving the existing segment into it alone. `PenAnchor.altBroken` now describes the anchor it is set on, not the one after it.
