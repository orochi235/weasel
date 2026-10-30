---
'@weasel-js/renderer': patch
---

A fill or a centered stroke with `vertexColors` joins the batch with the solids, images, gradients, and text
around it, rather than ending the run and drawing alone with a color buffer created and deleted every frame.
The colors are interpolated and mapped by a group's color matrix as before. An even-odd fill, an inside- or outside-aligned
stroke on a polygon, and a mesh past the batch's vertex cap still draw for themselves.
