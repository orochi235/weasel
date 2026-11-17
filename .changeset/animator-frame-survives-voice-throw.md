---
'@weasel-js/animator': patch
---

An animation whose hold or interpolator throws is retired with an `error` event, and the rest keep running. This covers a hold's `value` and `weight`, and a target tween's `easing`, `interpolate` and `interpolator`.

<!-- entry: fix -->
