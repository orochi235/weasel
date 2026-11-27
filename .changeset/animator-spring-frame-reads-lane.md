---
'@weasel-js/animator': patch
---

A frame of `animator.spring` and `animator.decay` calls with `onTick` costs about a fifth of what it did.

Each reads its value from blits' lane, and its motion only once it could be at rest.

<!-- entry: perf -->
