---
'@weasel-js/animator': patch
---

`animator.colorOverrides.set` repaints nothing when a channel is given the colors, or the function, it already holds.

<!-- entry: fix -->
