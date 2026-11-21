---
'@weasel-js/animator': patch
---

A timeline played again after it finished reports its next end and cancel to `animator.watch`.

When one of its tracks throws, it lets go of its targets.

<!-- entry: fix -->
