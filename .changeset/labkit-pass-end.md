---
'@weasel-js/labkit': patch
---

Fixes: on a looping trial clock, End and a scrub to the far right of a transport landed at the start of the next pass, so the playhead showed at the left edge, and on a counted loop repeated End presses walked through the passes and ended the run. They now stand at the end of the pass the playhead is in, however often pressed, and playing on from there runs into the next pass.

Adds API, on an agent's judgment: `TrialClock.seek(elapsed, 'end')` reads a time on the line between two passes as the end of the earlier one, `phase` 1, until the clock next moves; the default, `'start'`, is the start of the later one as before. `ClockPosition` gains an optional `passEnd`, so a clock left there reopens there.
