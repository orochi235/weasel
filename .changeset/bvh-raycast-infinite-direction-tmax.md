---
'@weasel-js/geom': patch
---

A BVH `raycast` given a negative `tMax` hits nothing when the direction has an infinite component, as it already did for a finite direction.

<!-- entry: fix -->
