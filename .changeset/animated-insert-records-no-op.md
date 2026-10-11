---
'@weasel-js/core': patch
---

`animateLifecycle` over `animateOnSetPose`: an animated insert wrote its start pose through the animating wrapper, which recorded an `'animate'` transform op from the final pose back to the start pose, so every animated insert left a stray undo step. The start pose is now written at once, past any wrapper that animates `setPose`.
