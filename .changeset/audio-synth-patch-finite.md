---
'@weasel-js/audio': patch
---

`playNote` and `playNoise` throw a `RangeError` at the call on a non-finite duration, envelope, filter, or glide number.

A negative duration or glide time throws too.

<!-- entry: fix -->
