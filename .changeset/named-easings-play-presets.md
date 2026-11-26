---
'@weasel-js/animator': patch
'@weasel-js/core': patch
---

A named easing plays as blits carries Penner's curves: a CSS bezier within 0.003 of geom's curve, or a `linear()` within 0.001.

Tweens, timelines, clips, color animations and core's rewind resolve a name through `resolveKeyEasing`, so a name plays the same curve blits runs on the GPU and an export of it writes. A bezier or a function plays as before.

<!-- entry: behavior -->
