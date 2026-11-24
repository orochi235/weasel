---
'@weasel-js/geom': patch
---

`pathCrossings` reports a crossing at a path's vertex once, not once for each segment meeting there, so a trim at that point gets one cut.

<!-- entry: fix -->
