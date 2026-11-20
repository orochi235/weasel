---
'@weasel-js/cursor': patch
---

`haloFitsInBox` and `rotationFitsInBox` refuse a path `placeCursorPath` would refuse.

They throw on a command outside `M`, `L`, `A` and `Z`, on an elliptical arc, and on a command whose numbers are not whole points.

<!-- entry: fix -->
