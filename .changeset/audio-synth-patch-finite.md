---
'@weasel-js/audio': patch
---

`playNote` and `playNoise` throw a `RangeError` at the call on a duration, envelope, filter, or glide number that is not finite, or a negative duration or glide time.

<!-- entry: fix -->
