---
"@weasel-js/core": patch
---

Fold linear gradients into the shared batch. A linear-gradient fill used to
bind its own program and break the run of solid geometry, image quads and
glyphs around it; now it stages alongside them, so a page of gradient-filled
shapes is one draw rather than one per shape.

It rides the plain paint mode with no shader arm of its own. A linear
gradient's ramp position is affine in position, so a vertex can carry it and
the rasterizer's interpolation across a triangle is exact — which makes such a
fill a textured quad off the ramp atlas and nothing else. Fill opacity and
group alpha ride the vertices the way a solid's already did. Fills, stroke
ribbons and glyph-outline meshes all take the route.

Radial and conic gradients are not affine in the ramp position and still take
their own draw, as do per-vertex-colored and even-odd fills.

The ramp atlas is what makes the slot arithmetic work: every gradient in a run
shares one texture slot, so a document full of them costs the same one slot a
single gradient does. Growing the atlas moves every row, so a bake that would
grow it — or recycle a row — flushes the run first.

Gradient fills now apply the group's color matrix. `gradFill` was the only
paint program that did not, and since the batch program applies it to
everything in a run, leaving it out would have made a linear gradient and a
radial one under the same group paint differently.
