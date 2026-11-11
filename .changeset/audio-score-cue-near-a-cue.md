---
"@weasel-js/audio": patch
---

A score's cue reading gives a mood within rounding of a cue's own mood wholly to that cue, instead of a `NaN` weight to every cue. This holds for `readScoreCue` and a score's `state().cue`.

<!-- entry: rank=-5 fix -->
