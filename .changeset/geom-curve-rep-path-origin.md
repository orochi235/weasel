---
'@weasel-js/geom': patch
---

Curve representations' `toPath` gives a path far from 0 an `origin`, so its points land on the anchors.

<!-- entry: fix -->
