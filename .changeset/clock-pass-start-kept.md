---
"@weasel-js/clock": patch
---

A clock standing at the start of a pass now stays there through a `declare` or an `override` instead of moving to the end of the pass before, and raising `loop` on an ended clock leaves it showing the end of the pass it ended in, as a `declare` of the same loop already did.
