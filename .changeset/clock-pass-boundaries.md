---
"@weasel-js/clock": patch
---

A clock's `pass` and `phase` agree on where it stands at pass durations no double divides evenly. At 50 ms into a run of 0.1 ms passes it read pass 500 at phase 0.9999999999999722, a whole pass ahead of the time; it now reads pass 500 at phase 0. A `loop` write or a `declare` that leaves the clock at the end of a pass keeps it there, where the sum could land a hair past the line and read as the next pass's start, and one near the start of a pass no longer reads as the end of the pass before when the time within it rounds away.
