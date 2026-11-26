---
'@weasel-js/animator': patch
'@weasel-js/core': patch
---

Tweens, color animations, handoffs and core's rewind take an easing as a timeline key does, blits' `steps` and `linear` included.

Each resolves its easing through `resolveKeyEasing`, so a curve given as blits data plays wherever a name, a bezier or a function already did.

<!-- entry: api -->
