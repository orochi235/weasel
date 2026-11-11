---
"@weasel-js/paint": patch
---

The last frame of a color tween lands exactly on its target color.

`lerpColorArray` lands on `to` at `t = 1`, as `lerpPaint` did: every channel in `'rgb'`, and alpha in the other spaces. `lerpOklab` and `lerpOklch` (lightness and chroma) end on `to` the same way.

<!-- entry: rank=-5 fix -->
