---
'@weasel-js/audio': patch
---

`playNote` throws a `RangeError` at the call on an inharmonic partial whose `gain` is not finite.

<!-- entry: fix -->
