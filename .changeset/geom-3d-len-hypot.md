---
'@weasel-js/geom': patch
---

`len` and `distance` in `@weasel-js/geom/3d` measure very large and very small vectors, and `intersectRayPlane` meets planes along them.

<!-- entry: fix -->
