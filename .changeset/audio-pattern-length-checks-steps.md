---
'@weasel-js/audio': patch
---

`patternLength` throws a `RangeError` on a `stepsPerBeat` that is not a whole number, 1 or more, as the pattern player does, rather than returning `NaN` or a fractional length.

<!-- entry: fix -->
