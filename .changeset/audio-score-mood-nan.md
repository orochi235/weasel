---
'@weasel-js/audio': patch
---

`createScore`, `setMood`, `readScoreCue`, and `resolveScoreMood` throw a `RangeError` on a mood axis that is `NaN`.

<!-- entry: fix -->
