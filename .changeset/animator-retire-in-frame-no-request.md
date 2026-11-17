---
'@weasel-js/animator': patch
---

Canceling an animation from another's `onTick` no longer asks for a frame ahead of the one the frame in progress asks for, so a paint that `onTick` requests is not followed by a frame that paints nothing.

<!-- entry: fix -->
