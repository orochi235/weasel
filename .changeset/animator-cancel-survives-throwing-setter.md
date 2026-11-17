---
'@weasel-js/animator': patch
---

Canceling an animation whose target's setter throws still takes it, and with `cancelAll` every other animation, off the animator before the error is thrown.

<!-- entry: fix -->
