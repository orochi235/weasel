---
'@weasel-js/audio': patch
---

Fixes: a pattern event on a fractional `step` never played, because the player looked events up by whole step. It is booked with the step it sits in and sounds that fraction of a step later, so `{ step: 2.25 }` is a hit that drags a quarter of a step, and the default pattern length counts it by the step it sits in.

Adds API, on an agent's judgment:

- `PatternPlayerOptions.detune` and `PatternPlayer.setDetune`: cents added to every event's own `detune`, as a number or a function of the event's step (`PatternDetune`), for a loop that drifts in pitch. A new value takes effect from the next step not yet booked.
- `patternVoicePeaks(events, opts)`: the most voices a pattern holds at once on each bus, to set against `voiceLimit`. It counts a note through its gate and release, a voice from one lookahead before it sounds (when the engine takes its slot), and a loop's tail against the start of the next pass.
- `patternLength(events, stepsPerBeat?)`: the length a player gives a pattern that names none.
