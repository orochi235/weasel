---
'@weasel-js/core': patch
---

`Stroke.width` accepts `{ px }` for a width in screen pixels, resolved against the accumulated transform scale at draw time. Callers previously divided by `meanScale(view.scale)` at each site; this moves that into the renderer and lets the stroke mesh cache key see the resolved width.
