---
'@weasel-js/animator': patch
---

`animator.loop` and `animator.tweenLoop` throw a `RangeError` for a `count` that is not a whole number or `Infinity`, such as `NaN` or `2.5`.

<!-- entry: fix -->
