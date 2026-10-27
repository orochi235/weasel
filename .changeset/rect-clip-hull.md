---
'@weasel-js/renderer': patch
---

A slanted item (a turned rect, a mesh, a slanted glyph) crossing an axis-aligned rect clip no longer breaks the batch on a single-sampled canvas: the rect clip goes to the batch shader as four half-planes for that item, while axis-aligned items inside it are still cut on the CPU. To make the two agree pixel for pixel, a rect clip on such a canvas now has its edges snapped to a sixteenth of a device pixel, the grid convex clips already use, so an edge that sat within a thirty-second of a pixel of a pixel center can now keep or drop that column. On a multisampled canvas nothing changes.

`ClipEntry` gains a required `uncutHulls` field; code that builds clip entries itself needs to set it.
