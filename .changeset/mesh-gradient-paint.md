---
'@weasel-js/core': patch
'@weasel-js/svg': patch
'@weasel-js/ui': patch
---

A sixth paint kind: `mesh-gradient`, PDF's shading types 6 and 7. A mesh is a
set of curved quadrilateral patches, each carrying a color at every corner, so
its color field bends where the three gradients can only run straight. Twelve
control points make a Coons patch and sixteen a tensor patch, which is the only
difference between them.

It is registered through `registerPaintKind` rather than built into the
renderer, so every slot it uses is one a consumer's own kind can use. The paint
is rasterized once into a 256-texel bake the shader samples — forward, the way
every renderer that draws these works, because a paint has to answer "what color
is this fragment" and inverting a bicubic per fragment does not. Corner colors
blend through `interpolate`, as a gradient's stops do.

`@weasel-js/svg` writes it as `<wzl:meshGradient>` with every patch's points in
full — not SVG's abandoned `<meshgradient>`, whose implicit edge sharing gives a
reader a way to be quietly wrong — and reads it back. A renderer that skips the
def paints the fallback color beside the reference.

`MeshEditor` in `@weasel-js/ui` edits the corner colors and the blend space, and
`PaintInput` renders it: before this, a mesh in that control fell through to the
color field, which wrote a solid back over it.
