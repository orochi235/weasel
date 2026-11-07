---
'@weasel-js/paint': patch
'@weasel-js/stroke': patch
---

An inner or outer stroke on a rect with a negative width or height (a pose flipped by a drag past its opposite edge) stays on its own side of the rect. `alignedStrokeRect` used to shift such an axis the wrong way, so an outer stroke drew inside the rect along it and an inner one outside.
