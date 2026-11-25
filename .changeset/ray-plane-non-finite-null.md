---
'@weasel-js/geom': patch
---

`intersectRayPlane` answers `null` for a ray or offset that would place the hit at `NaN` or infinity, as `intersectRayAabb` does, rather than returning that `t`.

<!-- entry: fix -->
