---
"@weasel-js/clock": patch
---

A clock at the start of a pass stays there through a `declare` or `override`. Raising `loop` on an ended clock leaves it at the end of the pass it ended in, as a `declare` of the same loop does.

<!-- entry: rank=-5 fix -->
