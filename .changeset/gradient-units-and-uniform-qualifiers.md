---
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

Three fixes found by re-checking backlog entries against the code.

SVG gradients survive a round trip. The parser now reads `gradientUnits`
(`objectBoundingBox` → `units: 'bounds'`, `userSpaceOnUse` → `'world'`) and the
serializer writes back whichever the paint declares, instead of hardcoding
`userSpaceOnUse` on the way out — which had been reading a box-relative
gradient's `0..1` geometry as page coordinates, i.e. a gradient the size of a
pixel.

`unpackSvgFiles` keeps gradient fills instead of flattening them to a solid.
The reason recorded for the flattening — that the `kit:path` painter has no
gradient slot — had not been true for some time; `NodeFill` is
`string | FillStyle`, now exported. A `userSpaceOnUse` gradient is normalized
against the leaf's own box on the way in, so it survives the fit-clamp and
drop-point placement that move the geometry out from under it. Gradient
*strokes* still flatten: `data.stroke` genuinely is a color string.

`extractUniformNames` skips precision and interpolation qualifiers. `uniform
highp float u_t;` — the common spelling in hand-written GLSL — matched nothing
at all, so the uniform got no location and every write to it was dropped in
silence. Comma-separated declarator lists (`uniform float a, b;`) read too.

Also adds `tests/visual/text-decoration.spec.ts`, a baseline-free assertion
that underline and strikethrough sit `0.40 em` apart and span only their own
runs. It measures the gap between two gap-free horizontal ink runs, which is
something `text.spec.ts`'s 5% diff tolerance cannot see move.
