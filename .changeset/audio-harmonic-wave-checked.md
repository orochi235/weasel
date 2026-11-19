---
'@weasel-js/audio': patch
---

`playNote` throws a `RangeError` at the call on a harmonic wave with no levels or with a level that is not finite.

<!-- entry: fix -->
