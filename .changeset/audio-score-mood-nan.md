---
'@weasel-js/audio': patch
---

`createScore`, `setMood`, `readScoreCue` and `resolveScoreMood` throw a `RangeError` on a mood with a NaN axis, and `setMood` keeps the mood it had.

A NaN axis used to throw a `TypeError` at every bar line of a running score, which then replayed its last bar.

<!-- entry: fix -->
