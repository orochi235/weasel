---
"@weasel-js/core": patch
---

Fold gradients into the shared batch. A gradient fill used to bind its own
program and break the run of solid geometry, image quads and glyphs around it;
now it stages alongside them, so a page of gradient-filled shapes is one draw
rather than one per shape.

All three kinds go, and for the same reason — not that the ramp position is
affine in position, which is true only of a linear gradient, but that the
*coordinate* the ramp position is computed from is affine in all three. So a
vertex carries that and the rasterizer's interpolation across a triangle is
exact. A linear gradient's coordinate is the ramp position itself, which is why
it needs no paint mode of its own; a radial or conic one carries a
gradient-space point, with its atlas row where a plain vertex keeps its alpha,
and the shader takes a `length` or an `atan` of it behind a branch on the flat
paint mode. Fill opacity and group alpha ride the vertices the way a solid's
already did, and fills, stroke ribbons and glyph-outline meshes all take the
route.

Per-vertex-colored and even-odd fills still take their own draw, as do patterns
and shaders.

The ramp atlas is what makes the slot arithmetic work: every gradient in a run
shares one texture slot, so a document full of them costs the same one slot a
single gradient does. Growing the atlas moves every row, so a bake that would
grow it — or recycle a row — flushes the run first.

Gradient fills now apply the group's color matrix. `gradFill` was the only
paint program that did not, and since the batch program applies it to
everything in a run, leaving it out would have made a linear gradient and a
radial one under the same group paint differently.
