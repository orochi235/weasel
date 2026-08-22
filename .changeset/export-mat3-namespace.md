---
'@weasel-js/core': patch
---

Export the `mat3` namespace from the package entry

`resolveSkeleton` returns `Map<string, Mat3>` and `Mat3` was exported as a
type, but the operations that read one were not. Placing a bone tip meant
indexing the `Float32Array` by hand — `[m[0] * length + m[6], m[1] * length +
m[7]]` — which is the matrix layout leaking into consumer code.

`mat3` is now importable from `@weasel-js/core`, so that line is
`mat3.apply(m, length, 0)`. Alongside `apply` the namespace carries
`identity`, `multiply`, `translate`, `scale`, `invert` and `screenToClip`.

This is the renderer's 9-element column-major form, matching what
`uniformMatrix3fv` uploads. `@weasel-js/geom` exports its own `Mat3` — a
6-element affine — with the same logical element order but a different array
shape; the two are not interchangeable.
