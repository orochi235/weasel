---
'@weasel-js/core': patch
---

Bake the rect batch's transform and alpha into its vertices, so a rotated or
partly-transparent node no longer breaks a run.

`RectBatch.push` now maps the four corners through the model matrix itself and
the flush draws at `u_model` identity — ~12 flops against the ~66 us a draw call
costs. An affine maps a rect to a parallelogram, so the two-triangle index
pattern still covers it. Group alpha multiplies into the vertex alpha the same
way fill opacity already did. Neither is batch state any more.

Frame cost for rects each wrapped in their own transform group — what
`wrapNodeOutput` emits for a rotated node — M2 Max via ANGLE at 800x600
(`npm run test:perf`, new `rotated` variant):

| rects | before | after |
|---|---|---|
| 400 | 24.94 ms | 0.08 ms |
| 1,600 | 102.78 ms | 0.42 ms |
| 3,200 | 216.90 ms | 0.52 ms |

The color matrix stays a uniform and stays a barrier. The shader applies it and
its clamp to the straight-alpha source *before* multiplying by `u_alpha`, so a
pre-multiplied vertex alpha is the same number only under an identity matrix —
which is every scene that does not use one. Alpha therefore folds only there,
and rides `u_alpha` otherwise.
