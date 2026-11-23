---
'@weasel-js/audio': patch
---

`patternVoicePeaks` and `patternLength` throw a `RangeError` for an event step that is not finite, as the pattern player does.

<!-- entry: fix -->
