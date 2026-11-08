---
'@weasel-js/stroke': patch
'@weasel-js/paint': patch
'@weasel-js/svg': patch
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

Stroke, paint and alignment fixes:

- A closed zero-length subpath (`M5 5Z`, `M5 5L5 5Z`) draws its round or square cap as a dot, as SVG strokes it.
- A closed subpath's last vertex takes a mid marker.
- An inner stroke at least as wide as a rect's narrower side fills the rect, as it does the same polygon, instead of turning the rect inside out and drawing outside it. `ribbonAligns` (stroke) and `alignedStrokeRectHolds` (paint) say when a rect's aligned ribbon is built in place.
- An upright selection outline and the selection handles' outlines are aligned once; they were shifted for `align` and then shifted again by the renderer.
- SVG export writes gradient stops in offset order, and a stop past 0..1 as the color the ramp has there, so the file reads back as the gradient the kit paints.
- Interpolating two gradients pairs their stops by offset, not by list position.
