---
'@weasel-js/labkit': patch
---

Export `usePanZoom` from `@weasel-js/labkit` and `@weasel-js/labkit/canvas`,
alongside `UsePanZoomOptions` and `PanZoomHandlers`.

The 2D camera was reachable only by adopting `CanvasStack`, which owns its own
`<canvas>` elements and layer scheduler — exactly what a lab hosting a foreign
renderer through `surface` has opted out of. Its 3D peer `useOrbit` was already
exported standalone, so such a lab got the orbit camera from labkit and had to
reimplement the pan/zoom one, cursor-anchored wheel zoom and reachable-opening-
zoom clamp included.

`useOrbit` now also rides the `/canvas` subpath, where the two cameras sit
together.
