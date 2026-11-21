---
'@weasel-js/geom': patch
---

`snipPathAt` removes one piece, not two, when the probe is nearest a crossing that sits on an anchor of the path.

A closed subpath crossed only there comes back in `removed` once around, not twice.

<!-- entry: fix -->
