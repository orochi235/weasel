---
'@weasel-js/core': patch
---

Full-screen effect passes: a group's children render into a texture, shader
passes run over it, and the result composites back where the group sits.

Until now the renderer could draw over the frame but never transform it —
nothing sampled what had already been drawn, so blur, bloom and distortion were
unreachable and the only recourse was a CSS `filter` on the `<canvas>`, which is
the browser compositing on the kit's behalf.

`GroupDrawCommand.effects` is the primitive. It is the one field there that does
not accumulate down the group stack: it is a render-target boundary. The
children draw into a buffer with a stencil of its own, each effect reads the
previous one's output, and the composite applies the group's `transform`,
`alpha` and `colorMatrix` plus whatever clip encloses it — so the enclosing clip
clips the result rather than the pixels an effect reads, and nested clips inside
start from a fresh depth budget.

`RenderLayer.effects` is that field folded in at `drawOneLayer`, which is where
every layer already gets wrapped in a group. A blur there blurs one layer and
leaves the chrome drawn above it sharp, which is the thing the CSS filter cannot
do.

`blur({ radius })` and `vignette({ amount })` ship as built-ins; both return
`Effect[]` because a separable blur is honestly two passes.
`registerEffect(id, frag)` registers your own — it is `registerProgram` with the
effect vertex shader, and using the custom-shader one instead compiles, runs,
and samples the source upside down.

Nothing is allocated until a group declares an effect, so a canvas without them
carries no offscreen buffer. Buffers are drawing-buffer sized, pooled per
renderer, and dropped on resize, dispose and context loss.

Demo: "Full-screen effect passes", with visual baselines blurred and sharp.
