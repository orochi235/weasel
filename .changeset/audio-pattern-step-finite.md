---
'@weasel-js/audio': patch
---

`createPatternPlayer` and `setEvents` throw a `RangeError` on an event whose `step` is not finite, which was never played.

<!-- entry: fix -->
