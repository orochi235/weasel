---
'@weasel-js/animator': patch
---

A target tween or spring with `compositor` set checks its `to`, `from`, `velocity` and spring constants before it interrupts what holds its `cancelKey`, as one on the main thread does.

<!-- entry: fix -->
