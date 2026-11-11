---
"@weasel-js/clock": patch
---

A clock's `pass` and `phase` agree where it stands when the pass duration does not divide evenly. 50 ms into a run of 0.1 ms passes reads pass 500 at phase 0. A `loop` write or `declare` that leaves the clock at a pass's end keeps it there, and one near a pass's start no longer reads as the previous pass's end.

<!-- entry: fix -->
