---
'@weasel-js/d3': patch
---

A transition whose tween is stopped from outside, by `animator.cancelKey`, `animator.cancelAll` or a tick that threw, ends as an interrupt instead of never ending.

<!-- entry: fix -->
