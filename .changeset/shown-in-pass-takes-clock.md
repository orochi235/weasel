---
"@weasel-js/clock": patch
"@weasel-js/forge": patch
---

`shownInPass` takes the clock itself, and a clock at the start of a pass now shows `origin`.

Replace `shownInPass(origin, elapsed, duration, loop)` with `shownInPass(clock)`. It reads the time within the pass `clock.pass` names, so it agrees with `clock.phase`; forge's playhead readout follows.

<!-- entry: breaking fix -->
