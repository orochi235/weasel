---
'@weasel-js/core': patch
---

A pan flung after the pointer paused briefly before release coasts slower, in proportion to the pause, instead of at the full throw speed.

`getVelocity(now)` averages over the time up to `now`, not up to the last move.

<!-- entry: fix -->
