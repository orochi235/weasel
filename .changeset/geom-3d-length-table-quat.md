---
'@weasel-js/geom': minor
---

`@weasel-js/geom/3d` builds a 3D path's length table with `lengthTable3(points, closed)`, and adds `quatFromBasis` and `quatSlerp`.

`quatFromBasis(x, y, z)` is the rotation taking the local axes to an orthonormal, right-handed basis; `quatSlerp(a, b, t)` interpolates along the shorter arc. The `LengthTable` type is exported from the subpath too.

<!-- entry: api new -->
