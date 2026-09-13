---
'@weasel-js/geom': patch
'@weasel-js/kernel3d': patch
---

`@weasel-js/geom/3d` now judges singularity the way the 2D kernel does: against the matrix's own scale, never against an absolute floor.

- `invert` on a 4x4 compares the determinant with the product of the four column lengths. A uniformly tiny matrix, such as a scale of `1e-4`, now inverts; so does a projection with a very small near plane. A large matrix whose determinant is only rounding now returns `null`, and so does a matrix holding `NaN`, which used to come back as a matrix of `NaN`s.
- `normalize` keeps the direction of any vector with a finite, non-zero length. It used to return the zero vector below a length of `1e-9`, which collapsed `lookAt` for a camera less than `1e-9` from its target.
- `lookAt` returns a singular matrix when `up` is parallel to the view to within rounding, as it already did when exactly parallel.
- `transformPoint` always divides by w. It used to skip the division below `|w| < 1e-9`, so a camera with a far plane beyond about `1e9` cast rays in the wrong direction.
- `intersectRayAabb` and `intersectRayPlane` accept a direction of any length. A ray counts as parallel to a plane only to within rounding of its own length.
- `EPS3` is removed. Nothing in the subpath uses an absolute tolerance any more. This is a breaking change for anything that imported it.

In `@weasel-js/kernel3d`, `rayThroughScreenPoint` now returns `null` when the view-projection has no inverse or the pane has no area. It used to return a made-up ray from the eye straight down -z. This is a type-level breaking change. The built-in deps handle `null`: `createNodeAtPoint` picks nothing, `createInsert` inserts nothing, and the pose descriptor's `translate` keeps dragging through the last camera that did cast a ray. `projectAabbToScreen` no longer drops points closer to the eye than `1e-9`, so a scene at a tiny scale projects the same as it does at unit scale.
