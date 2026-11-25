---
'@weasel-js/geom': patch
---

`splitPathByPolyline` and `snipPathByPolyline` cut a path at a joint of the cut only where it passes through to the cut's other side.

A path that only touches a joint is left uncut, and one that crosses the cut at a joint while just grazing one segment's line is now cut.

<!-- entry: fix -->
