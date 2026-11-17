---
'@weasel-js/animator': patch
---

Canceling an animation from another's `onTick` asks for no extra frame. A paint that `onTick` requests is no longer followed by a frame that paints nothing.

<!-- entry: fix -->
