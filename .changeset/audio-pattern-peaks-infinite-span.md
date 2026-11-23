---
'@weasel-js/audio': patch
---

`patternVoicePeaks` throws a `RangeError` on an event that sounds for a time that is not finite or is `NaN`, such as a looping hit whose `hitMs` is `Infinity`.

<!-- entry: fix -->
