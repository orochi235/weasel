---
"@weasel-js/core": patch
---

Put every baked gradient ramp in one texture, a row each, rather than a texture
each. `GradientRampAtlas` replaces `GradientRampCache`: a stop list is baked
once into a 256-texel strip and written to a row, and the fragment shader picks
its row with `u_rampV`. Every gradient in a frame now samples the same texture
unit, which is what a gradient needs before it can take a batch texture slot
the way a bitmap or a font atlas already does.

The atlas doubles from 16 rows and stops at 1024, recycling the least recently
used row past that. An animating gradient mints a new stop list every frame, so
the old cache grew a GL texture per frame and freed none of them; the cap is
what bounds that.

`PaintBindContext.bindRamp` now returns the `v` its ramp sits at. A registered
paint kind that samples the ramp at a constant `v` reads whatever gradient
happens to own that row, so it must sample at the returned value.
