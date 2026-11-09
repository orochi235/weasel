---
"@weasel-js/geom": patch
---

`boundsOfPath` now includes the origin a path with no opening `M` is drawn from, so its bounds cover the stroke the renderer draws.
