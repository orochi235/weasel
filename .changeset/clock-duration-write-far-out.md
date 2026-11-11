---
"@weasel-js/clock": patch
---

Assigning a clock's `duration` keeps its pass far into a run. The new time was computed as `(pass + phase) * duration`, which past ten billion passes rounds a phase near 1 up into the next pass.
