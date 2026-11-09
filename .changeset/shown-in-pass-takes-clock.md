---
"@weasel-js/clock": patch
"@weasel-js/forge": patch
---

`shownInPass` now takes the clock itself, `shownInPass(clock)`, in place of `(origin, elapsed, duration, loop)`: a breaking signature change. It reads the time within the pass `clock.pass` names, so a clock at the start of a pass shows `origin`, not `origin + duration`, agreeing with `clock.phase`; forge's playhead readout follows.
