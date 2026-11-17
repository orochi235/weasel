---
'@weasel-js/animator': patch
---

A compositor tween or spring checks its input before it interrupts its `cancelKey`, as one on the main thread does. That is its `to`, `from`, `velocity` and spring constants.

<!-- entry: fix -->
