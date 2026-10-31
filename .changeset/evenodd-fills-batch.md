---
'@weasel-js/geom': patch
'@weasel-js/renderer': patch
---

An even-odd fill whose contours neither cross nor touch now tessellates to an ordinary triangulation (`earcut`, rings
nested an odd number deep cut as holes) instead of a per-contour fan with `requiresStencil`, so the renderer stages it
into the batched run like a nonzero fill. Contours that cross, touch, or overlap are first rebuilt as the boundary of
their even-odd fill, the way crossing nonzero outlines already were, and a contour of no area is dropped; only a fill
whose crossings would cost more than `MAX_EVENODD_RESOLVE_WORK` (now exported from `@weasel-js/geom/tessellate`) to
resolve keeps the stencil fan.

The stencil's cover pass now paints each pixel of an even-odd fill once: a translucent fill whose fan overlapped
itself, such as a concave outline, used to blend once per overlapping triangle and come out too opaque.
