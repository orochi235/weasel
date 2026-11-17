---
'@weasel-js/animator': patch
---

A hold whose `value` or `weight` throws, or a target tween whose `easing`, `interpolate` or `interpolator` throws, is retired with an `error` event, and the animator's other animations keep running.

<!-- entry: fix -->
