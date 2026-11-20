---
'@weasel-js/cursor': patch
---

`haloFitsInBox` and `rotationFitsInBox` throw on a path command outside `M`, `L`, `A` and `Z`, on an elliptical arc, and on a command whose numbers are not whole points, as `placeCursorPath` does.

<!-- entry: fix -->
