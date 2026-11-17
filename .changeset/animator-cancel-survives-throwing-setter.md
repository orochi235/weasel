---
'@weasel-js/animator': patch
---

Canceling an animation whose target's setter throws still takes it off the animator before the error is thrown. `cancelAll` cancels every other animation first.

<!-- entry: fix -->
