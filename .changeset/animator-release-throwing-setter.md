---
'@weasel-js/animator': patch
---

A hold released while its target's setter throws still leaves the animator, so its `cancelKey` and `isActive` are free again.

<!-- entry: fix -->
