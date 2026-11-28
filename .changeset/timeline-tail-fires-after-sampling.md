---
'@weasel-js/animator': patch
---

A handler at the end of a looping timeline's lap reads the values of the frame that crossed it, not the frame before.

<!-- entry: fix -->
