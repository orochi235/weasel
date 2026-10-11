---
'@weasel-js/geom': patch
'@weasel-js/svg': patch
---

`transformPath` keeps a rect a rect when the matrix's rotation and shear terms are within 1e-9 of zero, so a rect under a half turn or any composed map that is axis-aligned to rounding is no longer promoted to a polygon. `@weasel-js/svg` now transforms and measures paths with geom's `transformPath` and `boundsOfPath` in place of its own copies.
