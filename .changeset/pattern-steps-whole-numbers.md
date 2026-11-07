---
'@weasel-js/audio': patch
---

`createPatternPlayer`, its `setEvents`, and `patternVoicePeaks` throw a `RangeError` on a `length` or
`stepsPerBeat` that is not a whole number of 1 or more, and `patternVoicePeaks` on a tempo the player
refuses. A length of 0 or `NaN` used to play nothing while `onStep` reported `NaN`, and
`patternVoicePeaks` with a length of 0 never returned.
