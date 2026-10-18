---
'@weasel-js/geom': patch
'@weasel-js/path-tools': patch
---

A polygon-pose node rotated after a warp keeps its warp. `resolvePathWarp` used to recover only a move or a resize of the stored coordinates; it now recovers any affine rewrite of them, with the new `fitAffine` in `@weasel-js/geom` (the least-squares affine map between two point sets, falling back to a similarity for points on one line).
