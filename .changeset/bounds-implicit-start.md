---
"@weasel-js/geom": patch
---

`boundsOfPath` includes the origin a path with no opening `M` is drawn from, so its bounds cover the stroke the renderer draws.

<!-- entry: rank=-5 fix -->
