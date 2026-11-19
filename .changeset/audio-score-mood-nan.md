---
'@weasel-js/audio': patch
---

`createScore`, `setMood`, `readScoreCue`, and `resolveScoreMood` throw a `RangeError` on a mood axis that is `NaN`; out-of-range values still read as the nearest end.

<!-- entry: fix -->
