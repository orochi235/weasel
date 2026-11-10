---
"@weasel-js/paint": patch
---

`lerpColorArray` lands exactly on `to` at `t = 1`, as `lerpPaint` already did: in `'rgb'` every channel, and alpha in the other spaces. A channel could miss it by an ulp, so the last frame of an animator color tween painted a hair off its target. `lerpOklab` and `lerpOklch` (lightness and chroma) end on `to` the same way.
