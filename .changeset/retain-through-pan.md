---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

A retained world layer now keeps its surface through a pan. `drawLayers` marks an unchanged world layer for retaining while the view only translates, and stops only for a zoom. The renderer composites the kept surface moved when the pan is a whole number of device pixels and what it drew still covers the buffer; past that it draws the surface again with a margin of an eighth of the buffer past each edge, so following pans keep reusing it. A pan by a fraction of a device pixel draws the layer straight through, keeping the surface, until the view holds for a frame. A layer holding a custom shader, a gradient or pattern in screen units (the default), a world-unit paint with no view matrix, a texture paint on text, or a group with effects, isolation or a composite operator is drawn again on every move instead, since those do not move with the view. `RetainedSurfaces.lookup` now returns what to do (`kept`, `redraw` with the window to draw, or `through`) rather than pixels or `null`; `RetainedSurfaces` is internal.
