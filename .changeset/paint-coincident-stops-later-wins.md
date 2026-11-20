---
'@weasel-js/paint': patch
---

A gradient sampled exactly at an offset two stops share takes the later stop's color, as CSS draws a hard color break, in `sampleGradientStops` and the GL ramp.

<!-- entry: fix visual -->
