---
'@weasel-js/animator': patch
---

`createElementTarget` throws when given `get` without `set`, or `set` without `get`, where an animation on it had come to rest back where it started.

<!-- entry: fix -->
