---
'@weasel-js/geom': patch
---

`isAnchorSmooth` reads an anchor whose two handles point the same way as a corner, so fairing and handle drags leave such a cusp alone.

<!-- entry: fix -->
