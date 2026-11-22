---
'@weasel-js/geom': patch
---

`intersectRayAabb` and a BVH's `raycast` miss a box when the ray has an infinite origin, or an infinite direction from outside the box.

<!-- entry: fix -->
