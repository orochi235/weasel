---
'@weasel-js/geom': patch
'@weasel-js/renderer': patch
---

An even-odd fill whose contours neither cross nor touch now tessellates to an ordinary triangulation (`earcut`, rings
nested an odd number deep cut as holes) instead of a per-contour fan with `requiresStencil`, so the renderer stages it
into the batched run like a nonzero fill. Contours that cross, touch, overlap or have no area keep the stencil fan.

The stencil's cover pass now paints each pixel of an even-odd fill once: a translucent fill whose fan overlapped
itself, such as a concave outline, used to blend once per overlapping triangle and come out too opaque.
