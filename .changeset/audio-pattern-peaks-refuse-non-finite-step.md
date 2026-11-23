---
'@weasel-js/audio': patch
---

`patternVoicePeaks` and `patternLength` throw a `RangeError` for an event whose step is not finite, as the pattern player does, rather than answering no voices or a `NaN` length.

<!-- entry: fix -->
