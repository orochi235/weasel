---
"@weasel-js/paint": patch
---

`lerpPaint` and `lerpStroke` land exactly on the second paint or stroke at `t = 1`. A gradient's stop offsets and geometry, a stroke's width, and its dash offset could come back an ulp off, so blending from offset 0.17 to 0.02 ended at 0.01999999999999999.
