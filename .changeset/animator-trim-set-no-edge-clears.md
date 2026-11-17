---
'@weasel-js/animator': patch
---

`animator.trimOverrides.set` with neither `start` nor `end` drops the node's override, so `has` no longer reports a trim that paints nothing.

<!-- entry: fix -->
