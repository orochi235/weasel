---
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

Every 2D affine inversion now uses `@weasel-js/geom`'s `invert` and its singularity rule, which judges the determinant against the matrix's own scale.

- SVG import now keeps a transform under a uniformly tiny parent scale, such as `scale(0.0000001)`. It used to call that parent singular and bake the child's rotation into the wrong space. A parent that really is singular now drops the child's transform with a warning, and so does a large parent whose determinant is only rounding. `@weasel-js/svg` now depends on `@weasel-js/geom`.
- A gradient or pattern measured in `units: 'local'` or `'world'` now draws nothing when that space has no inverse, for example under a group that scales an axis to zero. It used to draw as if untransformed. `mat3.invert` returns `null` for such a matrix instead of the identity, and `PaintBindContext.spaceInverse` now returns `Mat3 | null`, so a registered paint kind should return `null` from `bind` when it gets `null`. Both are type-level breaking changes.
- In the custom-shader vertex prelude, `v_world` now reads the world origin when the view has no inverse, instead of a scaled mapping that looked plausible and was wrong.
- `useNodeOverlayFrame`'s `toLocal` now keeps the last mapping that had an inverse while a live view flattens an axis. It used to hand the overlay point back unchanged.
