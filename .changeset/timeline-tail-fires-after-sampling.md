---
'@weasel-js/animator': patch
---

An event handler at the end of a looping timeline's lap reads the values of the frame that crossed it, as handlers elsewhere in the lap do, rather than the frame before.

<!-- entry: fix -->
