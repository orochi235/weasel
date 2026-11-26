---
'@weasel-js/animator': patch
'@weasel-js/core': patch
---

A named easing plays as its preset in `EASING_PRESETS`, within 0.003 of geom's curve as a bezier or 0.001 as a `linear()`.

Tweens, timelines, clips, color animations and core's rewind resolve a name through `resolveKeyEasing`, so a name plays the same curve an export of it writes. A bezier or a function plays as before.

<!-- entry: behavior -->
