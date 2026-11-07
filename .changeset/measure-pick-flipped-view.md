---
'@weasel-js/core': patch
---

A click picks the measurement under it, and the measurements layer claims a press on one, in a view flipped on x. The hit radius used to be divided by the x scale alone, which came out negative there and matched nothing; it now goes through `pxReach` like every other screen-pixel reach.
