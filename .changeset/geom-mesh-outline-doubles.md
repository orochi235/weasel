---
'@weasel-js/geom': patch
---

`trianglesToPath` keeps a small mesh far from the origin in shape when its coordinates are doubles rather than float32 values.

<!-- entry: fix -->
