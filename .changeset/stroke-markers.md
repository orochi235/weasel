---
'@weasel-js/core': patch
'@weasel-js/paint': patch
'@weasel-js/svg': patch
---

Add stroke markers — arrowheads and other line terminators as stroke style.

`markerStart` / `markerMid` / `markerEnd` on `Stroke` take a key resolved
through a new registry (`registerMarker`), shipping eight built-in shapes.
Unlike SVG, the stroke stops short of a filled head rather than running under
it to the tip; the distance is declared per marker, so an open V still reaches
the vertex. Round-trips through `@weasel-js/svg` as `marker-*` attributes plus
`<marker>` defs.
